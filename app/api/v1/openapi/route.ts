import { NextResponse } from "next/server";
import { withRequestLog } from "@/lib/security/request-log";

const errorResponse = { $ref: "#/components/responses/Error" };

export const GET = withRequestLog(function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Future Atlas client API",
      version: "2026-09-26",
      description: "Study-abroad AI for signed access tokens. Issue tokens from a signed-in Future Atlas session, then call the AI from your server. A written guide is in docs/client-api.md.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/tokens": {
        post: {
          summary: "Issue an access token and a refresh token",
          description: "Requires the website sign-in session. Replaces any previous pair for the account.",
          responses: { "201": { description: "Token pair" }, "401": errorResponse, "403": errorResponse, "429": errorResponse },
        },
        get: {
          summary: "Read token status for the signed-in account",
          responses: { "200": { description: "Expiry and remaining API allowance" }, "401": errorResponse },
        },
        delete: {
          summary: "Revoke an access token, a refresh token, or every token for the signed-in account",
          responses: { "200": { description: "Revocation result" }, "400": errorResponse, "401": errorResponse },
        },
      },
      "/api/tokens/refresh": {
        post: {
          summary: "Mint a new access token from a refresh token",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } } } },
          },
          responses: { "200": { description: "New access token" }, "400": errorResponse, "401": errorResponse, "429": errorResponse },
        },
      },
      "/api/tokens/validate": {
        post: {
          summary: "Check whether a token is still usable",
          responses: { "200": { description: "Validity, and type plus expiry when valid" }, "400": errorResponse, "429": errorResponse },
        },
      },
      "/api/v1/ai": {
        post: {
          summary: "Generate a study-abroad answer",
          security: [{ accessToken: [] }],
          parameters: [
            { in: "header", name: "Idempotency-Key", required: false, schema: { type: "string", minLength: 8, maxLength: 128 }, description: "Send the same key only when retrying the same request." },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/AIRequest" } } },
          },
          responses: {
            "200": { description: "Completed answer. Structured modes return data. Mentor returns response." },
            "400": errorResponse,
            "401": errorResponse,
            "409": errorResponse,
            "413": errorResponse,
            "429": errorResponse,
            "502": errorResponse,
            "503": errorResponse,
          },
        },
      },
      "/api/v1/health": {
        get: {
          summary: "Readiness check that does not call the model",
          responses: { "200": { description: "Ready" }, "503": { description: "Degraded" } },
        },
      },
      "/api/v1/openapi": {
        get: { summary: "This document", responses: { "200": { description: "OpenAPI 3.1 document" } } },
      },
    },
    components: {
      securitySchemes: {
        accessToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "fa_atk_",
          description: "Access token from POST /api/tokens. It starts with fa_atk_ and lasts 1 hour.",
        },
      },
      schemas: {
        AIRequest: {
          type: "object",
          required: ["mode", "message"],
          properties: {
            mode: { enum: ["mentor", "cost", "country", "eligibility", "scholarship", "university"] },
            message: { type: "string", minLength: 1, maxLength: 8000 },
            inputs: { type: "object" },
            responseFormat: { enum: ["structured"] },
            history: { type: "array", maxItems: 6 },
            stream: { type: "boolean" },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                retryable: { type: "boolean" },
                retryAfter: { type: "integer" },
                requestId: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        Error: {
          description: "Request failed",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  });
});
