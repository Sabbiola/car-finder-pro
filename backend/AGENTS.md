# AGENTS.md

## Scope
This file applies to backend work inside `backend/` (FastAPI app).

Use this file for:
- FastAPI routes
- request/response models
- provider orchestration and adapters
- normalization, dedup, ranking/scoring
- provider health and observability

## Backend mission
The backend is the source of truth for:
- provider execution
- search orchestration
- normalized listing contracts
- dedup and ranking signals

Do not push this logic into the frontend.

## Backend architecture rules
Separate responsibilities:
1. API layer
2. provider selection/orchestration
3. provider implementations
4. normalization
5. deduplication
6. scoring/ranking

Do not let route handlers become orchestration engines.
Do not let provider adapters own ranking logic.

## API rules
- Use typed request/response models.
- Validate all inbound payloads.
- Keep route handlers thin.
- Keep streaming event names stable:
  - `progress`
  - `result`
  - `complete`
  - `error`

## Error handling rules
- Fail one provider without killing whole search where possible.
- Return structured provider errors to orchestrator.
- Distinguish user-facing messages from internal debug details.
- Avoid blanket catches without context.

## Security rules
- Never hardcode credentials.
- Load secrets from environment only.
- Bound outbound requests with timeout and retry policy.
- Sanitize and validate URLs.
- Avoid logging sensitive tokens or raw credentials.

## Testing rules
At minimum test:
- request validation
- provider selection
- normalization
- dedup
- scoring
- SSE event generation
- partial failure handling

