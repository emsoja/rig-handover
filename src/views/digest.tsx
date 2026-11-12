import type { Night } from '../digest/types.js';

const RETRY_MARK = 3;
const dash = (v: string | null) => v ?? '—';

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{dash(r.owner)}</td>
                <td>{r.runs}</td>
                <td class={r.retries >= RETRY_MARK ? 'warn' : undefined}>
                  {r.retries}
                  {r.retries >= RETRY_MARK ? ' ⚠' : ''}
                </td>
                <td class={r.lastStatus === 'fail' ? 'warn' : undefined}>
                  {r.lastStatus === 'fail' ? <strong>fail ✕</strong> : r.lastStatus}
                </td>
                <td>{dash(r.lastError)}</td>
                <td>{r.first}</td>
                <td>{r.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p class="mute">
        {night.badLines === 0 ? 'every line parsed' : `${night.badLines} line${night.badLines === 1 ? '' : 's'} did not parse`}
      </p>
    </>
  );
}
