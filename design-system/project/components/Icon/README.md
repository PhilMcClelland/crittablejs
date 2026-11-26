The eleven line glyphs the tool draws its controls with.

**Use it** inside buttons and beside labels. **You provide** the glyph name; the colour comes from the surrounding text.

- Markup: `span.ic` holding the inline SVG. It is 1.25em square, so size it with the font size of its button.
- Stroke 1.7, round caps and joins, no fill, on a 24 grid.
- `plus` is also the cancel mark: rotate it 45 degrees.
- An icon-only button always has an accessible label. Resolve is always the `tick`: with the word in a card, and alone, with a label and a tooltip, in the compact toggle of a panel row. Once resolved, the same tick sits on a filled `cm-done` disc, as it does on a resolved pin.
