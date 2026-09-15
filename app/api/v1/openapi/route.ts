import { NextResponse } from "next/server";

const errorResponse = { $ref: "#/components/responses/Error" };

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Future Atlas API",
      version: "1.0.0",
      description: "Tenant-aware study-abroad AI API.",
    },
    servers: [{ url: "/api/v1", description: "Current environment" }],
    paths: {
      "/ai": {
        post: {
          summary: "Generate a study-abroad AI response",
          security: [{ bearerAuth: [] }],
          parameters: [{
            in: "header",
            name: "Idempotency-Key",
            required: true,
            schema: { type: "string", minLength: 8, maxLength: 128 },
          }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Completed response" },
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "409": errorResponse,
            "429": errorResponse,
            "503": errorResponse,
          },
        },
      },
      "/tenants": {
        get: {
          summary: "List tenants for signed-in owner",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Tenant list" }, "401": errorResponse },
        },
        post: {
          summary: "Manage tenants, credentials, and domains",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Action completed" },
            "201": { description: "Tenant created" },
            "400": errorResponse,
            "401": errorResponse,
          },
        },
      },
      "/openapi": {
        get: {
          summary: "OpenAPI document",
          responses: { "200": { description: "OpenAPI 3.1 document" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Supabase JWT for management or tenant API key for AI.",
        },
      },
      schemas: {
        AIRequest: {
          type: "object",
          required: ["mode", "message"],
          additionalProperties: false,
          properties: {
            mode: { enum: ["mentor", "cost", "country", "eligibility", "scholarship", "university"] },
            message: { type: "string", minLength: 1, maxLength: 8000 },
            inputs: { type: "object" },
            responseFormat: { enum: ["structured"] },
            history: { type: "array", maxItems: 6 },
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
          description: "Stable API error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  });
}
