export default function KeyValueList({ items, emptyLabel }) {
  if (!items || items.length === 0) {
    return <div className="empty">{emptyLabel}</div>;
  }

  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item.label} className="list-row">
          <span>{item.label}</span>
          <span className="value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
