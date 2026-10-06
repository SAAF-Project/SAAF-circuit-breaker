import { PersonaSwarm } from "@/components/swarm";

export default function PersonasPage() {
  return (
    <main className="mx-auto max-w-[1440px] min-w-0 px-5 py-8">
      <p className="kicker">Swarm · scripted stakeholders</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
        Who puts pressure on the agent?
      </h1>
      <p className="mt-3 max-w-3xl text-[#c8c3b8]">
        Customers and satisfaction scores push for refunds; finance, risk and human reviewers push for policy checks.
      </p>
      <div className="mt-6 min-w-0">
        <PersonaSwarm />
      </div>
    </main>
  );
}
