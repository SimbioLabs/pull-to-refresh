import { useState, type CSSProperties, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import {
  PullToRefresh,
  RefreshIndicator,
  ScrollContainer,
} from "../src";
import { CrossfadeLabel } from "../src/crossfade-label";

const LABELS = {
  pull: "Pull to refresh",
  release: "Release to refresh",
  refreshing: "Refreshing",
} as const;

function DemoBody({ rows = 18 }: { rows?: number }) {
  return (
    <div className="demo-body">
      <p className="demo-note">Pull down from the top. The bar does not move.</p>
      {Array.from({ length: rows }, (_, index) => (
        <div className="demo-row" key={index}>
          Row {index + 1}
        </div>
      ))}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      className="ptr-shell demo-frame"
      style={{ ["--ptr-header-offset" as string]: "4rem" }}
    >
      <div className="demo-bar" data-testid="demo-bar">
        Inbox
      </div>
      {children}
    </div>
  );
}

function expectStableIndicator(canvasElement: HTMLElement) {
  const indicator = canvasElement.querySelector(".pull-to-refresh-indicator");
  const copy = canvasElement.querySelector(".pull-to-refresh-copy");
  const ring = canvasElement.querySelector(".pull-to-refresh-ring");
  expect(indicator).toBeTruthy();
  expect(copy).toBeTruthy();
  expect(ring).toBeTruthy();
  const indicatorStyle = getComputedStyle(indicator!);
  const copyStyle = getComputedStyle(copy!);
  const ringStyle = getComputedStyle(ring!);
  const shell = indicator!.closest(".demo-frame") ?? canvasElement;
  const indicatorBox = indicator!.getBoundingClientRect();
  const shellBox = shell.getBoundingClientRect();
  const indicatorCenter = indicatorBox.left + indicatorBox.width / 2;
  const shellCenter = shellBox.left + shellBox.width / 2;
  expect(Math.abs(indicatorCenter - shellCenter)).toBeLessThan(1);
  const matrix = indicatorStyle.transform.match(/matrix\(([^)]+)\)/);
  if (matrix) {
    const [a, , , d] = matrix[1]!.split(",").map((part) => Number.parseFloat(part));
    expect(a).toBeCloseTo(1, 2);
    expect(d).toBeCloseTo(1, 2);
  }
  expect(parseFloat(indicatorStyle.gap)).toBeGreaterThan(4);
  expect(parseFloat(indicatorStyle.gap)).toBeLessThan(8);
  expect(parseFloat(copyStyle.fontSize)).toBeGreaterThan(11);
  expect(parseFloat(copyStyle.fontSize)).toBeLessThan(13);
  expect(parseFloat(copyStyle.letterSpacing)).toBeLessThan(1);
  expect(ringStyle.width).toBe(ringStyle.height);
  expect(parseFloat(ringStyle.width)).toBeGreaterThan(30);
}

const meta = {
  title: "PullToRefresh",
  component: PullToRefresh,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    children: <DemoBody />,
    onRefresh: async () => {},
  },
} satisfies Meta<typeof PullToRefresh>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  render: () => (
    <Frame>
      <PullToRefresh onRefresh={async () => {}}>
        <DemoBody />
      </PullToRefresh>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector(".pull-to-refresh-root");
    await expect(root).toHaveAttribute("data-ptr-phase", "idle");
    const indicator = within(canvasElement).getByTestId("pull-to-refresh");
    await expect(indicator).toHaveAttribute("aria-hidden", "true");
    const bar = canvasElement.querySelector("[data-testid=demo-bar]");
    const first = within(canvasElement).getByText(/Pull down from the top/);
    expect(first.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      (bar?.getBoundingClientRect().bottom ?? 0) - 1,
    );
  },
};

function Snapshot({
  phase,
  pull,
  progress,
  spinning = false,
  active,
  tone = "default",
}: {
  phase: string;
  pull: string;
  progress: string;
  spinning?: boolean;
  active: keyof typeof LABELS;
  tone?: "default" | "armed";
}) {
  return (
    <Frame>
      <div
        className="pull-to-refresh-root"
        tabIndex={0}
        data-ptr-phase={phase}
        data-ptr-progress={progress}
        data-ptr-dragging="false"
        data-ptr-settling="false"
        style={
          {
            ["--ptr-pull" as string]: pull,
            ["--ptr-progress" as string]: progress,
            ["--ptr-header-offset" as string]: "4rem",
            ["--ptr-spin-start" as string]: "270deg",
          } as CSSProperties
        }
      >
        <RefreshIndicator
          phase={phase as "pulling"}
          progress={Number(progress)}
          spinStartDeg={270}
          label={
            <CrossfadeLabel
              tone={tone}
              activeId={active}
              items={[
                { id: "pull", text: LABELS.pull },
                { id: "release", text: LABELS.release },
                { id: "refreshing", text: LABELS.refreshing },
              ]}
            />
          }
          className={spinning ? "is-spinning" : undefined}
        />
        <div className="pull-to-refresh-content">
          <DemoBody />
        </div>
      </div>
    </Frame>
  );
}

export const Pulling: Story = {
  render: () => (
    <Snapshot phase="pulling" pull="64px" progress="0.91" active="pull" />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(LABELS.pull),
    ).toBeInTheDocument();
    expectStableIndicator(canvasElement);
  },
};

export const Armed: Story = {
  render: () => (
    <Snapshot
      phase="armed"
      pull="78px"
      progress="1"
      active="release"
      tone="armed"
    />
  ),
  play: async ({ canvasElement }) => {
    const indicator = within(canvasElement).getByTestId("pull-to-refresh");
    await expect(indicator).toHaveClass("is-armed");
    expectStableIndicator(canvasElement);
  },
};

export const Refreshing: Story = {
  render: () => (
    <Snapshot
      phase="refreshing"
      pull="76px"
      progress="1"
      active="refreshing"
      spinning
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByTestId("pull-to-refresh"),
    ).toHaveClass("is-spinning");
    expectStableIndicator(canvasElement);
  },
};

function InteractiveList() {
  const [count, setCount] = useState(0);
  return (
    <Frame>
      <PullToRefresh
        onRefresh={async () => {
          await new Promise((resolve) => setTimeout(resolve, 700));
          setCount((value) => value + 1);
        }}
      >
        <div className="demo-body">
          <p className="demo-note">Refresh count: {count}</p>
          <DemoBody rows={12} />
        </div>
      </PullToRefresh>
    </Frame>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveList />,
};

export const Disabled: Story = {
  render: () => (
    <Frame>
      <PullToRefresh disabled onRefresh={async () => {}}>
        <DemoBody rows={8} />
      </PullToRefresh>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector(".pull-to-refresh-root");
    await expect(root).toHaveAttribute("data-ptr-phase", "idle");
  },
};

export const PlainScroll: Story = {
  render: () => (
    <Frame>
      <ScrollContainer>
        <DemoBody rows={8} />
      </ScrollContainer>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector(".pull-to-refresh-root")).toBeNull();
    expect(canvasElement.querySelector(".ptr-scroll")).toBeTruthy();
  },
};

export const ScrollContainerAlias: Story = {
  render: () => (
    <Frame>
      <ScrollContainer pullToRefresh onRefresh={async () => {}}>
        <DemoBody rows={8} />
      </ScrollContainer>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector(".pull-to-refresh-root")).toBeTruthy();
  },
};

export const CustomIndicator: Story = {
  render: () => (
    <Frame>
      <PullToRefresh
        renderIndicator={(state) => (
          <span>
            {state.label ?? "Ready"} · {state.phase}
          </span>
        )}
        onRefresh={async () => {}}
      >
        <DemoBody rows={8} />
      </PullToRefresh>
    </Frame>
  ),
};
