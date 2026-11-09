import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { DonutChart } from "@/components/tremor/donut-chart";

const data = [{ name: "Computador", value: 80 }, { name: "Celular", value: 20 }];

afterEach(cleanup);

describe("Tremor donut controlled selection", () => {
  it("clears an external legend selection when the chart background is clicked", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <DonutChart data={data} category="name" value="value" activeCategory="Computador" onValueChange={onValueChange} />
    );

    fireEvent.click(container.querySelector(".recharts-surface")!);

    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("switches and clears selected sectors without the chart reset handler overriding the click", () => {
    const onValueChange = vi.fn();
    const { container, rerender } = render(
      <DonutChart data={data} category="name" value="value" activeCategory="Computador" onValueChange={onValueChange} />
    );

    fireEvent.click(container.querySelectorAll(".recharts-pie-sector")[1]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({ categoryClicked: "Celular", value: 20 }));

    rerender(<DonutChart data={data} category="name" value="value" activeCategory="Celular" onValueChange={onValueChange} />);
    fireEvent.click(container.querySelectorAll(".recharts-pie-sector")[1]);
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });
});
