import { inertHtml as ih, type Html } from "foldkit/html";
import type { IconNode } from "lucide";

const shapes = {
  path: ih.path,
  circle: ih.circle,
  rect: ih.rect,
  line: ih.line,
  ellipse: ih.ellipse,
  polyline: ih.polyline,
  polygon: ih.polygon,
} as const;

// Renders a Lucide icon with the same defaults lucide-react used.
export const icon = (node: IconNode, className = "size-4", strokeWidth = 2): Html =>
  ih.svg(
    [
      ih.AriaHidden(true),
      ih.Class(`lucide ${className}`),
      ih.Xmlns("http://www.w3.org/2000/svg"),
      ih.ViewBox("0 0 24 24"),
      ih.Fill("none"),
      ih.Stroke("currentColor"),
      ih.StrokeWidth(String(strokeWidth)),
      ih.StrokeLinecap("round"),
      ih.StrokeLinejoin("round"),
    ],
    node.map(([tag, attributes]) =>
      shapes[tag as keyof typeof shapes](
        Object.entries(attributes).map(([key, value]) => ih.Attribute(key, String(value))),
      ),
    ),
  );
