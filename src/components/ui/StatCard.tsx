interface Props {
  label: string;
  value: string | number;
  color?: "green" | "blue" | "purple" | "orange" | "red" | "cyan" | "default";
}

const colorMap = {
  green: "text-cs-accent-green",
  blue: "text-cs-accent-blue",
  purple: "text-cs-accent-purple",
  orange: "text-cs-accent-orange",
  red: "text-cs-accent-red",
  cyan: "text-cs-accent-cyan",
  default: "text-cs-text-primary",
};

export function StatCard({ label, value, color = "default" }: Props) {
  return (
    <div className="cs-card p-5">
      <p className="cs-label">{label}</p>
      <p className={`text-3xl font-semibold mt-2 ${colorMap[color]}`}>
        {value}
      </p>
    </div>
  );
}
