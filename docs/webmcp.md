# WebMCP: Tools for Browser Agents

[WebMCP](https://developer.chrome.com/docs/ai/webmcp) is a proposed web standard from Chrome. It is in an origin trial.
A page registers tools. An AI agent in the browser calls these tools. It does not read the DOM or click buttons.

The site uses WebMCP to let an agent find information, open a booking page, select a slot, set the options and open the payment form.
The user sees each change in the page. The user always types the card data in the Stripe form.

The server MCP (`/api/mcp`) is for remote agents without a browser. WebMCP is for an agent in the browser tab of the user.
The two systems use the same option schemas.

## Tools

### All pages

| Tool                   | Hint     | Function                                                                                                       |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `list_experiences`     | readOnly | Gives each experience: name, start price, duration, number of people, and online booking or contact.          |
| `get_activity_details` | readOnly | Gives the techniques, the included items and the steps of a session for one activity: `splash` or `pouring`.   |
| `get_faq`              | readOnly | Without a question, gives the list of questions. With a question, gives one answer.                           |
| `open_booking_page`    | none     | Opens the booking page for an experience. It can add a date. It checks the number of guests before it opens. |

### Booking page, schedule step

| Tool                  | Hint          | Function                                                                                                  |
| --------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `find_open_slots`     | readOnly      | Gives a maximum of 10 open slots. The agent can filter by date range and by time of day.                 |
| `select_time_slot`    | none          | Selects a slot in the calendar. If the slot is not open, it gives the nearest open slots.                |
| `set_booking_options` | none          | Sets the options of the page. It gives the result, the price and the values that it changed.           |
| `get_booking_summary` | readOnly      | Gives the slot, the options, the price, and the reason if the user cannot pay yet.                       |
| `start_payment`       | consequential | Does the same action as the "Pay to book" button. It opens the Stripe form and gives the server price. |

### Other pages

- Payment step: no tools. Only the user can use this step.
- `/complete`: `get_booking_confirmation` (readOnly) gives the status, the title, the time and the amount.

Agents can book `couples`, `family`, `friends` and `open_session`. Team building shows the contact data.

## How it works

- **Feature detection.** If `document.modelContext` is not available, the page loads no WebMCP code and sends no request.
- **Registration.** All tools go through `src/webmcp/register.ts`. It registers each tool with an `AbortSignal`, sends an analytics event for each call, cuts output at 1,500 characters and changes errors into text for the agent.
- **Page state.** A React hook registers the booking tools on the schedule step and removes them at the payment step. A tool call always uses the latest React state.
- **Data.** The tool data and output text are in a static file for each language, `/webmcp/{lang}.json`. The page loads it at the first tool call.
- **Booking options.** The widgets and `set_booking_options` use the same pure functions for the option rules. If a value does not agree with a rule, the tool changes it and tells the agent why.
- **Payment.** `start_payment` uses the same request as the button. The server calculates the price, and the tool gives that price to the agent.

## Testing

1. In Chrome 149 or later, enable `chrome://flags/#enable-webmcp-testing` and restart Chrome.
2. Run `pnpm dev` and open `http://localhost:4321/en/`. You do not need a token on `localhost`.
3. In DevTools, open Application > WebMCP. You can see and run the tools of the page there.

Give tool input as an object, not as a JSON string.
For more information, see the [Chrome documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

## Decisions

### Imperative API, not declarative API

The site uses `document.modelContext.registerTool()`, not the `toolname` attributes on `<form>`.

- The site has no HTML `<form>` for booking. The booking flow is in React and Stripe.
- Many tools only read data. A declarative tool must have a form.
- The tools must calculate, filter and validate, and give clear errors.
- The booking tools must go away at the payment step.

If the site adds a plain HTML form, for example a contact form, use the declarative API for it.

### Tools only where they are useful

Each page registers only the tools that it can run.
Fewer tools use less of the agent context. An agent cannot call a booking tool without a booking form on the page.

### A separate tool to open the payment form

`start_payment` is a separate tool with `consequentialHint`.
The agent must show the summary to the user first, and the browser can ask the user to confirm.
The user types the card data, so an agent cannot complete a payment.

### Data in a static file

The tool data is in `/webmcp/{lang}.json`, not in the page.
Browsers without WebMCP do not load it, and browsers with WebMCP load it only when an agent uses a tool.
The cost: the first tool call waits for one small request (about 4.5 KB with gzip).

### English descriptions, output in the page language

The agent reads the descriptions, so one language is sufficient.
The agent shows the output to the user, so the output uses the language of the page.

### One set of option rules

The option rules are pure functions. The widgets and `set_booking_options` use them.
An agent and a person get the same result, and a change to a rule changes the two paths.
The cost: the option widgets were changed to use these functions.

### One set of option schemas

The server MCP and WebMCP use the same zod schemas, so they cannot show different options.
WebMCP changes them to plain JSON Schema without `$schema`, `additionalProperties`, the safe-integer limits and `exclusiveMinimum`.
With the full zod output, Chrome DevTools showed no parameters for `set_booking_options`.

### Simple schemas, strict code

The schemas are simple. The code does the strict validation and gives clear errors, so the agent can try again with correct values.

### Output limit of 1,500 characters

Chrome recommends 1,500 characters or less for each tool output.

- `find_open_slots` gives a maximum of 10 slots.
- `get_faq` gives the list of questions first, then one answer for each call.
- `list_experiences` gives no descriptions.
- `get_activity_details` gives one activity for each call, without the text that repeats other fields.

### Local types and a local hook

The code does not use the `webmcp-types` or `use-webmcp-tool` packages.
The API changes frequently. All calls go through `register.ts`, so an API change touches one file.

### Same origin only

The tools do not use `exposedTo`. No other site must call them.
