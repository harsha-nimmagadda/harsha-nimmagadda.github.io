// ============================================================
// BRILLIANCE API — Ask Analytics routes
// POST /ask — text-to-analytics using Claude Sonnet 4.6.
// Architecture: question → Claude → JSON plan → compiler → rows.
// LLM never writes SQL. Scope injected by compiler.
// ============================================================

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { success, error } from "../lib/response";
import {
  db,
  askThreads,
  askMessages,
  askPlanCache,
  askFeedback,
  askSuggestionsCache,
} from "@brilliance/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { buildScope } from "../lib/ask-analytics/scope";
import { buildSystemPrompt } from "../lib/ask-analytics/prompt";
import { generatePlan } from "../lib/ask-analytics/claude-client";
import { compilePlan, validatePlan } from "../lib/ask-analytics/compiler";
import { synthesizeNarrative } from "../lib/ask-analytics/narrative";
import type { Role, QueryPlan } from "../lib/ask-analytics/types";

const askAnalytics = new Hono();
askAnalytics.use("*", authMiddleware);

const ENABLED = () => process.env.ASK_ANALYTICS_ENABLED !== "false";

type SessionUser = {
  sub: string;
  role: Role;
  institutionId: string;
  branchId: string | null;
  batchIds?: string[];
};

function scopeHash(question: string, role: string, institutionId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${question.trim().toLowerCase()}|${role}|${institutionId}`)
    .digest("hex");
}

// ── POST /ask — main entry ────────────────────────────────

askAnalytics.post("/ask", async (c) => {
  if (!ENABLED()) {
    return c.json(error("DISABLED", "Ask Analytics is currently disabled", 503), 503);
  }

  const user = c.get("user") as SessionUser;
  if (!user) return c.json(error("UNAUTHORIZED", "Login required", 401), 401);

  let body: { question?: string; threadId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(error("VALIDATION_ERROR", "Invalid JSON body", 400), 400);
  }

  const question = body.question?.trim();
  if (!question || question.length < 3 || question.length > 500) {
    return c.json(error("VALIDATION_ERROR", "Question must be 3-500 characters", 400), 400);
  }

  try {
    const scope = await buildScope(user);
    const start = Date.now();

    // ── Plan cache check ──
    const hash = scopeHash(question, scope.role, scope.institutionId);
    const [cached] = await db
      .select()
      .from(askPlanCache)
      .where(and(eq(askPlanCache.hash, hash), gte(askPlanCache.expiresAt, sql`NOW()`)))
      .limit(1);

    let plan: QueryPlan;
    let tokensIn = 0;
    let tokensOut = 0;
    let cacheHit = false;

    if (cached) {
      plan = cached.planJson as QueryPlan;
      cacheHit = true;
      await db
        .update(askPlanCache)
        .set({ hitCount: sql`hit_count + 1` })
        .where(eq(askPlanCache.hash, hash));
    } else {
      const systemPrompt = buildSystemPrompt(scope.role);
      const result = await generatePlan({
        systemPrompt,
        userQuestion: question,
        role: scope.role,
      });
      plan = result.plan;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      cacheHit = result.cacheHit;

      // Write to plan cache (24h TTL)
      await db
        .insert(askPlanCache)
        .values({
          hash,
          planJson: plan as never,
          role: scope.role,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .onConflictDoUpdate({
          target: askPlanCache.hash,
          set: {
            planJson: plan as never,
            hitCount: 1,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            createdAt: sql`NOW()`,
          },
        });
    }

    // ── Compile → query ──
    const compiled = await compilePlan(plan, scope);

    // ── Ground the answer in the actual rows ──
    // compiled.narrative is plan.narrative (a pre-fetch description of the
    // metric). Replace it with an answer derived from the real result set.
    const narrative = await synthesizeNarrative({
      question,
      role: scope.role,
      plan,
      rows: compiled.rows,
      rowCount: compiled.rowCount,
      fallback: compiled.narrative,
    });
    const latencyMs = Date.now() - start;

    // ── Persist thread + message ──
    let threadId = body.threadId;
    if (!threadId) {
      const [thread] = await db
        .insert(askThreads)
        .values({
          userId: user.sub,
          role: scope.role,
          title: question.slice(0, 100),
          scopeJson: scope as never,
        })
        .returning({ id: askThreads.id });
      threadId = thread!.id;
    }

    await db.insert(askMessages).values({
      threadId,
      role: "user",
      question,
    });

    const [assistantMsg] = await db
      .insert(askMessages)
      .values({
        threadId,
        role: "assistant",
        planJson: plan as never,
        resultPreview: compiled.rows.slice(0, 20) as never,
        narrative,
        chartType: plan.chart.type,
        rowCount: compiled.rowCount,
        latencyMs,
        claudeTokensIn: tokensIn || null,
        claudeTokensOut: tokensOut || null,
        cacheHit,
      })
      .returning({ id: askMessages.id });

    return c.json(
      success({
        threadId,
        messageId: assistantMsg!.id,
        plan,
        rows: compiled.rows,
        rowCount: compiled.rowCount,
        narrative,
        chart: compiled.chart,
        followUpSuggestions: plan.followUpSuggestions,
        meta: {
          latencyMs,
          cacheHit,
          tokensIn,
          tokensOut,
        },
      }),
    );
  } catch (err) {
    console.error("[ask-analytics POST /ask] error:", err);
    return c.json(error("SERVER_ERROR", "Ask failed. Please try again.", 500), 500);
  }
});

// ── GET /ask/examples — role-scoped starter prompts ─────────

const EXAMPLES: Record<string, string[]> = {
  student: [
    "Which chapter am I weakest in?",
    "Predict my score if I keep this up.",
    "How much time do I spend on wrong answers vs right?",
  ],
  parent: [
    "How is my child improving vs the start of the year?",
    "Which subject needs the most attention?",
    "Where does my child rank in the batch?",
  ],
  faculty: [
    "Which students are at risk this week?",
    "Show me questions that the top quartile missed.",
    "Which topic needs a re-teach for my batch?",
  ],
  super_admin: [
    "Compare Class of 2024 vs Class of 2025 at month 6.",
    "Top 5 faculty by impact this quarter.",
    "Which branch has the lowest attendance trend?",
  ],
  branch_admin: [
    "Which batch has the most at-risk students?",
    "Faculty ranking by mastery delta this term.",
    "Attendance trend across my batches.",
  ],
};

askAnalytics.get("/ask/examples", async (c) => {
  const user = c.get("user") as SessionUser;
  const role = user?.role ?? "student";
  return c.json(success({ examples: EXAMPLES[role] ?? EXAMPLES.student }));
});

// ── POST /ask/feedback — thumbs up/down ─────────────────────

askAnalytics.post("/ask/feedback", async (c) => {
  const user = c.get("user") as SessionUser;
  if (!user) return c.json(error("UNAUTHORIZED", "Login required", 401), 401);

  let body: { messageId?: string; verdict?: string; correctionText?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(error("VALIDATION_ERROR", "Invalid JSON", 400), 400);
  }

  if (!body.messageId || !body.verdict) {
    return c.json(error("VALIDATION_ERROR", "messageId and verdict required", 400), 400);
  }

  if (!["up", "down", "flag"].includes(body.verdict)) {
    return c.json(error("VALIDATION_ERROR", "verdict must be up|down|flag", 400), 400);
  }

  try {
    await db.insert(askFeedback).values({
      messageId: body.messageId,
      userId: user.sub,
      verdict: body.verdict as "up" | "down" | "flag",
      correctionText: body.correctionText ?? null,
    });
    return c.json(success({ ok: true }));
  } catch (err) {
    console.error("[ask-analytics POST /ask/feedback] error:", err);
    return c.json(error("SERVER_ERROR", "Could not save feedback", 500), 500);
  }
});

// ── GET /ask/history — user's past threads ──────────────────

askAnalytics.get("/ask/history", async (c) => {
  const user = c.get("user") as SessionUser;
  if (!user) return c.json(error("UNAUTHORIZED", "Login required", 401), 401);

  try {
    const threads = await db
      .select({
        id: askThreads.id,
        title: askThreads.title,
        role: askThreads.role,
        createdAt: askThreads.createdAt,
        updatedAt: askThreads.updatedAt,
      })
      .from(askThreads)
      .where(eq(askThreads.userId, user.sub))
      .orderBy(desc(askThreads.updatedAt))
      .limit(50);
    return c.json(success({ threads }));
  } catch (err) {
    console.error("[ask-analytics GET /ask/history] error:", err);
    return c.json(error("SERVER_ERROR", "Could not load history", 500), 500);
  }
});

// ── POST /ask/refine — multi-turn follow-up ──────────────────

askAnalytics.post("/ask/refine", async (c) => {
  if (!ENABLED()) {
    return c.json(error("DISABLED", "Ask Analytics is currently disabled", 503), 503);
  }

  const user = c.get("user") as SessionUser;
  if (!user) return c.json(error("UNAUTHORIZED", "Login required", 401), 401);

  let body: { threadId?: string; followUp?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(error("VALIDATION_ERROR", "Invalid JSON body", 400), 400);
  }

  const { threadId, followUp } = body;
  if (!threadId) {
    return c.json(error("VALIDATION_ERROR", "threadId is required", 400), 400);
  }
  const followUpTrimmed = followUp?.trim();
  if (!followUpTrimmed || followUpTrimmed.length < 3 || followUpTrimmed.length > 500) {
    return c.json(error("VALIDATION_ERROR", "followUp must be 3-500 characters", 400), 400);
  }

  try {
    // Load the prior assistant message on the thread to get the last plan.
    const [priorMsg] = await db
      .select({ planJson: askMessages.planJson })
      .from(askMessages)
      .where(and(eq(askMessages.threadId, threadId), eq(askMessages.role, "assistant")))
      .orderBy(desc(askMessages.createdAt))
      .limit(1);

    if (!priorMsg) {
      return c.json(error("NOT_FOUND", "Thread or prior message not found", 404), 404);
    }

    const priorPlan = priorMsg.planJson as QueryPlan;
    const scope = await buildScope(user);
    const systemPrompt = buildSystemPrompt(scope.role);
    const start = Date.now();

    const result = await generatePlan({
      systemPrompt,
      userQuestion: followUpTrimmed,
      role: scope.role,
      priorPlan,
    });

    const compiled = await compilePlan(result.plan, scope);

    // Ground the answer in the actual rows (see POST /ask for why).
    const narrative = await synthesizeNarrative({
      question: followUpTrimmed,
      role: scope.role,
      plan: result.plan,
      rows: compiled.rows,
      rowCount: compiled.rowCount,
      fallback: compiled.narrative,
    });
    const latencyMs = Date.now() - start;

    // Persist the follow-up user message and new assistant response.
    await db.insert(askMessages).values({
      threadId,
      role: "user",
      question: followUpTrimmed,
    });

    const [assistantMsg] = await db
      .insert(askMessages)
      .values({
        threadId,
        role: "assistant",
        planJson: result.plan as never,
        resultPreview: compiled.rows.slice(0, 20) as never,
        narrative,
        chartType: result.plan.chart.type,
        rowCount: compiled.rowCount,
        latencyMs,
        claudeTokensIn: result.tokensIn || null,
        claudeTokensOut: result.tokensOut || null,
        cacheHit: result.cacheHit,
      })
      .returning({ id: askMessages.id });

    return c.json(
      success({
        threadId,
        messageId: assistantMsg!.id,
        plan: result.plan,
        rows: compiled.rows,
        rowCount: compiled.rowCount,
        narrative,
        chart: compiled.chart,
        followUpSuggestions: result.plan.followUpSuggestions,
        meta: {
          latencyMs,
          cacheHit: result.cacheHit,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        },
      }),
    );
  } catch (err) {
    console.error("[ask-analytics POST /ask/refine] error:", err);
    return c.json(error("SERVER_ERROR", "Refine failed. Please try again.", 500), 500);
  }
});

export { askAnalytics };
