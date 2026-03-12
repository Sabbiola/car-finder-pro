# AGENTS.md

## Scope
This file applies to frontend work inside CarFinder Pro frontend modules.

Use this file for:
- React pages/components/hooks
- client-side state and orchestration
- API client integration
- frontend types and feature modules

## Frontend mission
The UI should help the user decide:
- Is this listing interesting?
- Why is it interesting?
- What are risks?
- What should I do next?

## Frontend architecture rules
- Use TypeScript with explicit models.
- Keep page files thin; move orchestration to hooks/features.
- Keep presentational components mostly pure.
- Avoid duplicating parsing/transform logic across components.
- Keep domain logic out of JSX when possible.

## Runtime configuration rules
- Do not hardcode backend base URLs in feature code.
- Centralize runtime config in a single utility.
- If `.env` and `localStorage` are both used, keep one clear precedence.
- API config UI must read/write through the same runtime config utility.

## Search flow rules
Preferred flow:
1. validate form input
2. start search request
3. consume stream events (`progress`, `result`, `complete`, `error`)
4. merge results incrementally
5. show completion and partial failure states

## State management rules
- Keep server state and UI state separate.
- Use focused hooks/reducers for streaming search state.
- Avoid storing denormalized duplicate result state in multiple places.

## Testing rules
At minimum test:
- streaming search hooks
- runtime config resolution
- search form serialization
- sorting/filter behavior
- progress state transitions

