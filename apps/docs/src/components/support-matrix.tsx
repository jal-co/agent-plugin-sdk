import { allHarnessIds, FEATURES, getHarness, supportMatrix } from "ap-sdk";

/**
 * The feature × harness support table, generated from the SDK's own
 * `supportMatrix()` at build time so the docs can never drift from the code.
 */
export function SupportMatrix() {
  const matrix = supportMatrix();
  const ids = allHarnessIds();

  return (
    <div className="overflow-x-auto">
      <table className="my-0">
        <thead>
          <tr>
            <th className="text-left">Feature</th>
            {ids.map((id) => (
              <th key={id} className="text-center whitespace-nowrap">
                {getHarness(id).displayName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((feature) => (
            <tr key={feature}>
              <td className="font-medium whitespace-nowrap">{feature}</td>
              {ids.map((id) => (
                <td key={id} className="text-center">
                  {matrix[id]?.[feature] ? "✅" : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
