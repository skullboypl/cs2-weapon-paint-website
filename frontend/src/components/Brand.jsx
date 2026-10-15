import { Cloud } from "lucide-react";
export default function Brand() {
  return (
    <span className="ch-brand">
      <span className="ch-brand-icon">
        <Cloud size={25} strokeWidth={2.2} />
      </span>
      <span>
        CloudHub<span className="ch-brand-game">CS2 / SKIN STUDIO</span>
      </span>
    </span>
  );
}
