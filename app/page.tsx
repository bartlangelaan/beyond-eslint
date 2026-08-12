import { RuleHistoryChart } from "../components/rule-history-chart";
import { getRuleHistory } from "../lib/rule-history";

export const dynamic = "force-static";

export default async function Home() {
  const history = await getRuleHistory();

  return (
    <main>
      <RuleHistoryChart {...history} />
    </main>
  );
}
