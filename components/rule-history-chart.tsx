"use client";

import {
  bandX,
  defineChart,
  dot,
  lineY,
  whenFocused,
} from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { scaleUtc } from "d3-scale";
import { useMemo } from "react";

import type { RuleHistory, SeriesName } from "../lib/rule-history";

const series: readonly {
  color: string;
  dotted?: boolean;
  name: SeriesName;
}[] = [
  { color: "#16876c", name: "Biome" },
  { color: "#3974d4", name: "Oxlint" },
  { color: "#df7041", name: "RSLint" },
  { color: "#895dc7", name: "TTSC" },
  { color: "#59636f", name: "ESLint plugins", dotted: true },
];

interface ChartPoint {
  date: Date;
  rules: number;
  series: SeriesName;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const rangeFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function RuleHistoryChart({ firstDate, lastDate, points }: RuleHistory) {
  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      points.map((point) => ({
        ...point,
        date: new Date(`${point.date}T00:00:00.000Z`),
      })),
    [points],
  );

  const definition = useMemo(() => {
    const linterPoints = chartPoints.filter(
      (point) => point.series !== "ESLint plugins",
    );
    const eslintPoints = chartPoints.filter(
      (point) => point.series === "ESLint plugins",
    );
    const dates = chartPoints.filter(
      (point, index) =>
        index === 0 ||
        point.date.getTime() !== chartPoints[index - 1]?.date.getTime(),
    );
    const latestPoints = series.flatMap(({ name }) => {
      const point = chartPoints.findLast((candidate) => candidate.series === name);
      return point ? [point] : [];
    });

    return defineChart({
      marks: [
        whenFocused(
          bandX(dates, {
            x: "date",
            fill: "#dfe7e3",
            fillOpacity: 0.52,
          }),
          { match: "x" },
        ),
        decorative(
          lineY(linterPoints, {
            x: "date",
            y: "rules",
            z: "series",
            color: "series",
            strokeWidth: 2.5,
          }),
        ),
        decorative(
          lineY(eslintPoints, {
            x: "date",
            y: "rules",
            z: "series",
            color: "series",
            strokeDasharray: "3 7",
            strokeWidth: 2.5,
          }),
        ),
        decorative(
          dot(latestPoints, {
            x: "date",
            y: "rules",
            color: "series",
            r: 3.5,
            stroke: "#ffffff",
            strokeWidth: 1.5,
          }),
        ),
        dot(chartPoints, {
          x: "date",
          y: "rules",
          z: "series",
          color: "series",
          r: 2,
          fillOpacity: 0,
          stroke: "#ffffff",
          strokeOpacity: 0,
          strokeWidth: 2,
          states: [
            {
              when: { focus: "group" },
              style: { fillOpacity: 1, r: 5, strokeOpacity: 1 },
            },
            {
              when: { focus: "unmatched" },
              style: { opacity: 0.32 },
            },
          ],
        }),
      ],
      x: {
        scale: scaleUtc,
        axis: {
          ticks: {
            format: (date) => dateFormatter.format(date),
            spacing: 105,
          },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: {
          label: "Available rules",
          ticks: {
            format: (value) => value.toLocaleString("en"),
            spacing: 58,
          },
        },
      },
      color: {
        domain: series.map(({ name }) => name),
        range: series.map(({ color }) => color),
      },
      theme: {
        foreground: "#26302c",
        muted: "#6b756f",
        grid: "#dce2df",
        background: "transparent",
      },
      clip: true,
      focus: "group-x",
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: {
        use: tooltip,
        portal,
        anchor: "group-center",
        placement: ["top", "right", "left", "bottom"],
        sort: "color-domain",
        className: "rule-history-tooltip",
      },
    });
  }, [chartPoints]);

  return (
    <section className="chart-card">
      <header className="chart-header">
        <div>
          <p className="eyebrow">Rule availability</p>
          <h1>Beyond ESLint</h1>
          <p className="chart-description">
            Daily rule totals from every recorded stable release.
          </p>
        </div>
        <p className="date-range">
          {rangeFormatter.format(new Date(`${firstDate}T00:00:00.000Z`))}
          <span aria-hidden="true">—</span>
          {rangeFormatter.format(new Date(`${lastDate}T00:00:00.000Z`))}
        </p>
      </header>

      <ul className="chart-legend" aria-label="Chart series">
        {series.map(({ color, dotted, name }) => (
          <li key={name}>
            <span
              aria-hidden="true"
              className={
                dotted ? "legend-line legend-line-dotted" : "legend-line"
              }
              style={{ color }}
            />
            {name}
          </li>
        ))}
      </ul>

      <div className="chart-surface">
        <Chart
          definition={definition}
          height={540}
          initialWidth={1120}
          ariaLabel="Available lint rules by day"
          ariaDescription="Lines show the number of rules available in Biome, Oxlint, RSLint, and TTSC. A dotted line shows all non-deprecated rules across the tracked ESLint plugins."
        />
      </div>

      <p className="chart-note">
        The ESLint total starts once every tracked plugin has a recorded release.
      </p>
    </section>
  );
}
