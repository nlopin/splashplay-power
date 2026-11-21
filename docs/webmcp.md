# WebMCP: Tools for Browser Agents

[WebMCP](https://developer.chrome.com/docs/ai/webmcp) is a proposed web standard from Chrome. It is in an origin trial.
A page registers tools. An AI agent in the browser calls these tools. The agent does not read the DOM and does not click buttons.

With WebMCP, an agent can find information about the studio and book a session.
The agent opens the booking page, selects a slot, sets the options and opens the payment form.
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

### Payment step

The payment step has no tools. Only the user can use this step.

Agents can book `couples`, `family`, `friends` and `open_session`. Team building shows the contact data.

## How it works

- **Feature detection.** If `document.modelContext` is not available, the page loads no WebMCP code and sends no request.
- **Registration.** All tools use `src/webmcp/register.ts`. This file registers each tool with an `AbortSignal`. For each call, it sends an analytics event and cuts the output at 1,500 characters. It gives errors to the agent as text.
- **Page state.** A React hook registers the booking tools on the schedule step. The hook removes them at the payment step. A tool call always uses the latest React state.
- **Data.** The tool data and output text are in a static file for each language, `/webmcp/{lang}.json`. The page loads it at the first tool call.
- **Booking options.** The widgets and `set_booking_options` use the same pure functions for the option rules. If a value does not agree with a rule, the tool changes the value. Then it tells the agent the reason.
- **Payment.** `start_payment` sends the same request as the button. The server calculates the price. The tool gives this price to the agent.

## Testing

1. In Chrome 149 or later, set `chrome://flags/#enable-webmcp-testing` to "Enabled".
2. Restart Chrome.
3. Run `pnpm dev`.
4. Open `http://localhost:4321/en/`. A token is not necessary on `localhost`.
5. In DevTools, open Application > WebMCP. The panel shows the tools of the page. You can run each tool from the panel.

Give the tool input as an object. Do not give it as a JSON string.
For more information, refer to the [Chrome documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

## Decisions

### Imperative API, not declarative API

The site uses `document.modelContext.registerTool()`, not the `toolname` attributes on `<form>`.

- The site has no HTML `<form>` for booking. The booking flow is in React and Stripe.
- Many tools only read data. A declarative tool must have a form.
- The tools must calculate, filter and validate. They must also give clear errors.
- The page must remove the booking tools at the payment step.

If the site adds a plain HTML form, for example a contact form, use the declarative API for it.

### Tools only where they are useful

Each page registers only the tools that it can run.
Fewer tools use less of the agent context. An agent cannot call a booking tool if the page has no booking form.

### A separate tool to open the payment form

`start_payment` is a separate tool with `consequentialHint`.
The agent must show the summary to the user first. The browser can ask the user to confirm.
Only the user types the card data. Thus an agent cannot complete a payment.

### Data in a static file

The tool data is in `/webmcp/{lang}.json`, not in the page.
Browsers without WebMCP do not load it. Browsers with WebMCP load it only when an agent uses a tool.
Tradeoff: the first tool call waits for one small request (approximately 4.5 KB with gzip).

### English descriptions, output in the page language

The agent reads the descriptions. One language is sufficient for the agent.
The agent shows the output to the user. Thus the output uses the language of the page.

### One set of option rules

The option rules are pure functions. The widgets and `set_booking_options` use them.
An agent and a person get the same result. A change to a rule changes the two paths.
Tradeoff: we changed the option widgets to use these functions.

### Imperative handle on the option widgets

Each option widget keeps its own state. `set_booking_options` must change this state from `BookingForm`.
Each widget gives an `apply()` method to `BookingForm` with `useImperativeHandle`.
`apply()` uses the same pure functions as a click. It returns the price and the changed values immediately.

We did not use these alternatives:

- Move the state of the widgets to `BookingForm`. This is a large change to the booking flow for users.
- Give the values to the widget as a prop. The widget applies the values in an effect after the render. Thus the tool cannot return the result in the same call.

Tradeoff: two `apply()` calls before a render start from the same state. Each agent tool call is a separate call, thus this does not occur.

### One set of option schemas

The server MCP and WebMCP use the same zod schemas. Thus they cannot show different options.
WebMCP changes the schemas to plain JSON Schema. It removes `$schema`, `additionalProperties`, the safe-integer limits and `exclusiveMinimum`.
With the full zod output, Chrome DevTools showed no parameters for `set_booking_options`.

### Simple schemas, strict code

The schemas are simple. The code does the strict validation and gives clear errors. Then the agent can try again with correct values.

### Output limit of 1,500 characters

Chrome recommends 1,500 characters or less for each tool output.

- `find_open_slots` gives a maximum of 10 slots.
- `get_faq` gives the list of questions first, then one answer for each call.
- `list_experiences` gives no descriptions.
- `get_activity_details` gives one activity for each call, without the text that repeats other fields.

### Local types and a local hook

The code does not use the `webmcp-types` or `use-webmcp-tool` packages.
The API changes often. All calls use `register.ts`. Thus an API change affects only one file.

### Same origin only

The tools do not use `exposedTo`. Other sites cannot call them.
