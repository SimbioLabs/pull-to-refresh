import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";
import "../stories/demo.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "canvas",
      values: [{ name: "canvas", value: "#e7eaee" }],
    },
  },
};

export default preview;
