import BidRow from "./BidRow";

const listStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const emptyStyle = {
  fontSize: "0.85rem",
  color: "var(--text)",
  fontStyle: "italic",
  padding: "8px 0",
};

export default function BidList({ bids, currentUserId }) {
  if (!bids || bids.length === 0) {
    return <p style={emptyStyle}>No bids yet.</p>;
  }

  return (
    <div style={listStyle}>
      {bids.map((bid) => (
        <BidRow
          key={bid._id}
          bid={bid}
          isCurrentUser={String(bid.user) === String(currentUserId)}
        />
      ))}
    </div>
  );
}
