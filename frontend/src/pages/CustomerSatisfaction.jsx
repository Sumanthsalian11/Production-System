import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000"; // match your other pages

export default function CustomerSatisfaction() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/csat`).then((r) => setRows(r.data)).catch(console.error);
  }, []);

  const questions = [...new Set(rows.flatMap((r) => Object.keys(r.answers || {})))];

  return (
    <div style={{ padding: 20 }}>
      <h2>Customer Satisfaction Survey Responses</h2>
      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Submitted</th>
              <th>Responder</th>
              {questions.map((q) => <th key={q}>{q}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r._id}>
                <td>{i + 1}</td>
                <td>{new Date(r.submittedAt).toLocaleString()}</td>
                <td>{r.responder}</td>
                {questions.map((q) => <td key={q}>{r.answers?.[q] ?? ""}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={questions.length + 3} align="center">No responses yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}