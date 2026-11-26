The pin itself, grown on hover or focus: the note's first message over the reply row a click will open.

**Use it** to let someone read a note without opening it, and to show what opening it offers. **You provide** author, relative time, the note text and the current person's face for the reply row.

- Markup: `.card.peek` holding a `.lead` (the first message) and a `.compose` whose field is a `.mock` and whose Send is disabled. In the tool it sits inside the pin's `.bubble` shell; `data-tip` names the corner on the anchor (`tl`, `tr`, `br`, or none for bottom-left).
- It is the thread card's width, and the face does not move when it opens, so a click only adds the header and the replies.
- The sharp corner stays on the anchor while the shell grows. Never move the point; the pin rides inside as the face.
- It opens almost at once and stays open while the pointer is on it. It holds no working controls: a click anywhere opens the thread, and a drag moves the pin.
