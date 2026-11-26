A short list of choices that drops from an icon button: sort order, what to show, theme.

**Use it** for settings and rare actions. **You provide** the items, which are radios, checkboxes or plain actions, and the trigger.

- Markup: `.menu` with labelled items; the trigger is an `.icb` with `aria-expanded`.
- An open trigger and the active choice sit on `cm-accent-wash`. Checked marks are `cm-accent-ink`; a checked box fills with `cm-accent`.
- In a menu that has boxes or dots, plain actions start on the same text edge as the labels.
- A setting leaves the menu open: a checkbox, a choice of sort, a step of the theme. You see it take effect and can change your mind without reopening. An action closes it and returns focus to the trigger ("Mark all as read"). "Move list to other side" closes too, because the menu belongs to the panel that just moved. Arrow keys move without choosing; Enter or Space chooses.
- An action whose only result is its own words stays open so they can be read: "Copy link to share" becomes "Link copied" for two seconds. It leads the More menu, above a rule, and is there only when the store has a link to share.
- One menu open at a time, the card's included. Outside click and Escape close it and return focus to the trigger.
- A destructive item is the last one and uses `cm-err`.
- An item that is off for a reason says the reason in the menu, in a `.cap.why` line under it. A tooltip on a disabled button reaches neither keyboard nor touch.
