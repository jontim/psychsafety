# Psych Safety Agent Interface Development Guide

## Commands
- `npm run serve` - Start local Firebase emulators
- `npm run shell` - Start Firebase Functions shell
- `npm run start` - Alias for npm run shell
- `npm run deploy` - Deploy only functions to Firebase
- `npm run logs` - View Firebase functions logs

## Code Style Guidelines
- **Imports**: Use CommonJS (`require()`) for backend, ES modules for frontend
- **Error Handling**: Always use try/catch blocks with detailed error responses
- **Response Format**: Success: `{ data: result }`, Error: `{ error: message }`
- **Naming**: camelCase for variables/functions, descriptive names required
- **Logging**: Use console.log for info, console.error for errors
- **Frontend**: Separate concerns with HTML structure, CSS in `<style>`, JS in `<script>`
- **API Design**: Firebase Functions with CORS enabled, accepting JSON payloads
- **Comments**: Document complex logic, API parameters, and response formats

This is a Firebase application with cloud functions backend (NodeJS) and static frontend. The project implements a psychological safety training interface with conversational agents.