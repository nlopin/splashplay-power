# WebMCP: Tools for Browser Agents

## 1. Overview

WebMCP is a proposed web standard from Chrome. It is in an origin trial.
A web page uses WebMCP to give tools to an AI agent in the browser.
The agent calls a tool. The tool does the action in the page.
The agent does not read the DOM and it does not click buttons.

This site gives WebMCP tools for these tasks:

- Find information about the studio and the activities.
- Open the correct booking page.
- Find an open time slot and select it.
- Set the booking options.
- Open the payment form.
- Read the result of the booking.

The user sees each change in the page.
The user always types the card data in the Stripe form.
No tool touches card data. No tool completes a payment.

References:

- Overview: <https://developer.chrome.com/docs/ai/webmcp>
- Imperative API: <https://developer.chrome.com/docs/ai/webmcp/imperative-api>
- Best practices: <https://developer.chrome.com/docs/ai/webmcp/best-practices>
- Secure tools: <https://developer.chrome.com/docs/ai/webmcp/secure-tools>

## 2. Relation to the server MCP

The site also has a server MCP at `/api/mcp`.
The two systems are for different agents:

| System     | Agent                                        | Location of the tools  |
| ---------- | -------------------------------------------- | ---------------------- |
| Server MCP | A remote agent without a browser             | `src/pages/api/mcp.ts` |
| WebMCP     | An agent in the browser tab of the user      | `src/webmcp/`          |

| Server MCP tool           | WebMCP tool or tools                                       |
| ------------------------- | ---------------------------------------------------------- |
| `list_experiences`        | `list_experiences`                                         |
| `check_availability`      | `find_open_slots`                                          |
| `create_booking_checkout` | `select_time_slot`, `set_booking_options`, `start_payment` |
| `get_booking_status`      | `get_booking_confirmation`                                 |
| FAQ resource              | `get_faq`                                                  |

The two systems use the same option schemas.
The schemas are in `src/services/agentTools/schemas.ts`.

## 3. Tools

### 3.1 Tools on all pages

`Layout.astro` registers these tools on each page.

| Tool                   | Hint     | Function                                                                                                       |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `list_experiences`     | readOnly | Gives each experience: name, start price, duration, number of people, and online booking or contact.          |
| `get_activity_details` | readOnly | Gives the techniques, the included items and the steps of a session for one activity: `splash` or `pouring`.   |
| `get_faq`              | readOnly | Without a question, gives the list of questions. With a question, gives one answer.                           |
| `open_booking_page`    | none     | Opens the booking page for an experience. It can add a date. It checks the number of guests before it opens. |

### 3.2 Tools on a booking page

`BookingForm` registers these tools on the schedule step only.

| Tool                  | Hint          | Function                                                                                                  |
| --------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `find_open_slots`     | readOnly      | Gives a maximum of 10 open slots. The agent can filter by date range and by time of day.                 |
| `select_time_slot`    | none          | Selects a slot in the calendar. If the slot is not open, it gives the nearest open slots.                |
| `set_booking_options` | none          | Sets the options of the page. It gives the result, the price and the values that it changed.           |
| `get_booking_summary` | readOnly      | Gives the slot, the options, the price, and the reason if the user cannot pay yet.                       |
| `start_payment`       | consequential | Does the same action as the "Pay to book" button. It opens the Stripe form and gives the server price. |

Time of day uses Barcelona time:

- `morning`: before 14:00.
- `afternoon`: from 14:00 to 17:59.
- `evening`: from 18:00.

### 3.3 Tools on other pages

| Page            | Tools                                     |
| --------------- | ----------------------------------------- |
| Payment step    | None. Only the user can use this step.    |
| `/complete`     | `get_booking_confirmation` (readOnly)     |

`get_booking_confirmation` gives the status, the title, the time and the amount.
It uses the values that the server already shows on the page.
It does not send a new request.

### 3.4 Experiences for agents

Agents can book these experiences:

- `couples`
- `family`
- `friends`
- `open_session`

Agents cannot book `individual`. The page `/book/individual` registers no booking tools.
Team building has no online booking. `list_experiences` shows it with the contact data.

## 4. How the system works

### 4.1 Files

| File                                                   | Function                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `src/webmcp/register.ts`                               | Feature detection, registration, analytics, output limit, errors.  |
| `src/webmcp/useWebMcpTools.ts`                         | React hook. It registers a list of tools while a component is on the page. |
| `src/webmcp/types.ts`                                  | Local types for `document.modelContext`.                           |
| `src/webmcp/siteTools.ts`                              | Tools on all pages.                                                |
| `src/webmcp/bookingTools.ts`                           | Tools on a booking page.                                           |
| `src/webmcp/confirmationTool.ts`                       | Tool on `/complete`.                                               |
| `src/webmcp/slots.ts`                                  | Slot filters and time of day.                                      |
| `src/webmcp/data.ts`                                   | Loads `/webmcp/{lang}.json` one time for each language.            |
| `src/services/agentTools/webmcpData.ts`                | Builds the data for `/webmcp/{lang}.json`.                         |
| `src/services/agentTools/schemas.ts`                   | Option schemas. The server MCP and WebMCP use them.                |
| `src/components/booking/eventTypeOptions/formState.ts` | Rules for the booking options, as pure functions.                  |
| `src/pages/webmcp/[lang].json.ts`                      | Static route for the tool data.                                    |
| `src/components/WebMcpBookingConfirmation.astro`       | Gives the `/complete` result to the confirmation tool.             |

### 4.2 Registration

1. The page calls `isWebMcpAvailable()`. This function examines `document.modelContext`.
2. If the browser has no WebMCP, the page stops. It loads no more code and sends no request.
3. If the browser has WebMCP, the page loads the tool code.
4. `registerWebMcpTool()` registers each tool with an `AbortSignal`.
5. To remove the tools, the code aborts the signal.

`registerWebMcpTool()` also does these steps for each tool call:

- It sends the `AgentToolCalled` analytics event.
- It cuts the output at 1,500 characters.
- It catches errors. It gives the error text to the agent as the result.
- It catches a registration error, for example `NotAllowedError`. The page continues to work.

### 4.3 React state

The hook `useWebMcpTools` registers tools one time for each set of tool names.
A tool call always uses the latest React state.
The hook keeps the latest tools in a ref.
Thus the page does not register the tools again after each render.

### 4.4 Data and language

The tool data is in a static file for each language: `/webmcp/{es,en,ca,fr}.json`.
The page loads this file at the first tool call, not at registration.
Each file is 11–12.5 KB, or 4–4.6 KB with gzip.

The file contains:

- The experiences, the activities and the FAQ.
- The booking paths and the limits for the number of guests.
- The output text for the tools, from the `webmcp` namespace in `src/locales/*.json`.

The descriptions of tools and parameters are in English.
The tool output is in the language of the page.

`get_activity_details` uses the same config and text as the "What we offer" section on the home page.
The config is in `src/config/whatWeOffer.ts`.
If you change that section, the tool changes too.

### 4.5 Booking options

The option rules are pure functions in `formState.ts`.
The option widgets use these functions when the user clicks.
`set_booking_options` uses the same functions through an `apply()` handle.
Thus an agent and a person get the same result. Examples of rules:

- Pouring has no big canvas.
- The number of canvases has a minimum and a maximum for each group size.
- An open session cannot sell more seats than the seats that are free.

If a value does not agree with a rule, the tool changes the value.
The tool tells the agent which values it changed and why.

### 4.6 Payment

`start_payment` calls `/api/payment-session`.
The server calculates the price and sends `amountCents`.
The tool gives this server price to the agent.
After this step, the page shows the payment step. The booking tools are removed.

### 4.7 Origin trial

A production page must have an origin-trial token.
The token is in the environment variable `PUBLIC_WEBMCP_OT_TOKEN`.
`Layout.astro` adds `<meta http-equiv="origin-trial">` only when the variable has a value.

## 5. Procedures

### 5.1 Test the tools locally

1. In Chrome 149 or later, open `chrome://flags/#enable-webmcp-testing`.
2. Set the flag to "Enabled". Restart Chrome.
3. Start the dev server: `pnpm dev`.
4. Open `http://localhost:4321/en/`. You do not need a token on `localhost`.
5. Open DevTools. Go to Application > WebMCP.
6. Make sure that the panel shows the tools in section 3.1.
7. Open `/en/book/family`. Make sure that the panel also shows the tools in section 3.2.
8. Select a tool. Type the parameters. Click "Run tool".

You can also use the console:

```js
const tools = await document.modelContext.getTools();
await document.modelContext.executeTool(tools[0], {});
```

Give the input as an object. Do not give the input as a JSON string.
Chrome rejects a JSON string with this error: "invalid input object: value is not an object".

### 5.2 Set the origin-trial token

1. Go to <https://developer.chrome.com/origintrials/#/trials/active>.
2. Open the WebMCP trial. Click "Register".
3. Type the origin `https://splashplay.es`.
4. Copy the token.
5. In Netlify, set `PUBLIC_WEBMCP_OT_TOKEN` for the production context.
6. Deploy the site.

The token is not secret. It is in the HTML of each page.
The token has an expiry date. Renew the token before that date.
A preview deploy has a different origin. Use the Chrome flag to test a preview deploy.

### 5.3 Add a tool

1. Write the tool in the correct file in `src/webmcp/`.
2. Write the output text in the `webmcp` namespace of all four locale files.
3. Write unit tests. The tests make sure that the output is 1,500 characters or less in each language.
4. Add the tool to `public/llms.txt`.
5. Add the tool to section 3 of this document.

Obey these limits from the Chrome guidance:

| Item                  | Maximum characters |
| --------------------- | ------------------ |
| Tool name             | 30                 |
| Parameter name        | 30                 |
| Tool description      | 500                |
| Parameter description | 150                |
| Tool output           | 1,500              |

## 6. Decisions

### 6.1 Imperative API, not declarative API

Decision: The site uses `document.modelContext.registerTool()`.
It does not use the `toolname` attributes on `<form>`.

Reasons:

- The site has no HTML `<form>` for booking. The booking flow is in React and Stripe.
- Many tools only read data. A declarative tool must have a form.
- The tools must calculate, filter and validate. They must also give clear errors.
- The booking tools must go away at the payment step.

If the site adds a plain HTML form, for example a contact form, use the declarative API for that form.

### 6.2 Tools only where they are useful

Decision: Each page registers only the tools that it can run.

Reasons:

- The Chrome guidance recommends this.
- Fewer tools use less of the agent context.
- An agent cannot call a booking tool when no booking form is on the page.

### 6.3 A separate tool to open the payment form

Decision: `start_payment` is a separate tool with `consequentialHint`.

Reasons:

- The agent must stop and show the summary to the user first.
- The browser or the agent can ask the user to confirm.
- The user types the card data. An agent cannot complete a payment.

### 6.4 Data in a static file

Decision: The tool data is in `/webmcp/{lang}.json`. The page loads it at the first tool call.

Reasons:

- Browsers without WebMCP do not load it.
- Browsers with WebMCP load it only when an agent uses a tool.
- The locale files do not go into the client bundle.

### 6.5 English descriptions, output in the page language

Decision: Tool and parameter descriptions are in English. Tool output is in the language of the page.

Reasons:

- The agent reads the descriptions. One language is sufficient and easy to maintain.
- The agent shows the output to the user. The user reads the page language.

### 6.6 One set of option rules

Decision: The option rules are pure functions. The widgets and `set_booking_options` use the same functions.

Reasons:

- An agent and a person get the same result.
- A change to a rule changes the two paths at the same time.
- Unit tests can examine the rules without React.

### 6.7 One set of option schemas

Decision: The server MCP and WebMCP use the same zod schemas.
WebMCP changes them to plain JSON Schema.
It removes `$schema`, `additionalProperties`, the safe-integer limits and `exclusiveMinimum`.

Reasons:

- The two systems cannot show different options.
- With the full zod output, the Chrome DevTools panel showed no parameters for `set_booking_options`.

### 6.8 Validation in code, simple schemas

Decision: The schemas are simple. The code does the strict validation.

Reasons:

- The Chrome guidance recommends this.
- A clear error lets the agent try again with correct values.

### 6.9 Output limit of 1,500 characters

Decision: Each tool gives 1,500 characters or less. `register.ts` cuts longer output.

Results of this decision:

- `find_open_slots` gives a maximum of 10 slots. One slot is approximately 110 characters.
- `get_faq` gives the list of questions first. Then it gives one answer for each call.
- `list_experiences` gives no descriptions.
- `get_activity_details` gives one activity for each call. It does not give the "what you take home" text. It gives only the steps that do not repeat other fields.

### 6.10 No `individual` experience

Decision: Agents cannot book `individual`. Agents can book open sessions.

Reason: An open session is the correct option for one person.

### 6.11 Local types and a local hook

Decision: The code uses `src/webmcp/types.ts` and `useWebMcpTools`.
It does not use the `webmcp-types` package or the `use-webmcp-tool` package.

Reasons:

- The API changes frequently. Local code is easy to change.
- All calls go through `register.ts`. If the API changes, you change one file.

### 6.12 Same origin only

Decision: The tools do not use `exposedTo`. Other origins cannot call them.

Reason: No partner site must call the tools.

## 7. Known limits and open items

- The API is experimental. Chrome can change it. Read the Chrome documentation before you change the code.
- No test with a real agent was done. Do these scenarios with the Model Context Tool Inspector extension:
  - "Book a family session next Sunday afternoon for 2 adults and 2 kids, pouring."
  - "Couples, one big canvas, cheapest discounted slot this month."
  - "Open session on Halloween for 3."
  - A team-building request. The agent must give the contact data.
  - A full slot.
- `/api/payment-session` has no rate limit. An agent in a loop can create many Stripe sessions.
- The "included" text says that the studio is only for your group. This is not correct for an open session.
- The step about the pickup mentions a clothing item. The clothing activity is hidden.
