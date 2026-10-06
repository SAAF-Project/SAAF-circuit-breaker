import { merkleLayers } from "@/lib/ledger";

export function MerkleTree({ leaves, root }: { leaves: string[]; root: string }) {
  const layers = merkleLayers(leaves.slice(0, 16));
  return (
    <div className="noise-panel rounded-3xl p-5">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="kicker">Merkle DAG</p>
          <h2 className="font-display text-xl font-semibold">Genesis → instruction diff → decision</h2>
        </div>
        <p className="font-mono max-w-[46%] truncate text-[11px] text-[#e8c36a]">{root}</p>
      </div>
      <div className="space-y-3">
        {layers.map((layer, i) => (
          <div key={i} className="flex flex-wrap justify-center gap-1.5">
            {layer.map((node, j) => (
              <div
                key={`${i}-${j}`}
                className="font-mono rounded-md px-2 py-1 text-[9px] tracking-wider"
                style={{
                  background: i === layers.length - 1 ? "rgba(232,195,106,0.15)" : "rgba(62,224,197,0.08)",
                  color: i === layers.length - 1 ? "#e8c36a" : "#9aa3b2",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                title={node}
              >
                {node.slice(0, 8)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-[#9aa3b2]">
        Pairwise SHA-256. First 16 leaves shown. Independent auditors re-compute the root with zero LLM calls.
      </p>
    </div>
  );
}
