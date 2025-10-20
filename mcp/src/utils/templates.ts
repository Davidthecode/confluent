export const getStyleString = (styleObject: Record<string, string>): string => {
  return Object.entries(styleObject)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value}`)
    .join("; ");
};

export const styles = {
  body: {
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f6f6f6",
    margin: "0",
    padding: "0",
  },
  container: {
    borderCollapse: "collapse",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  header: {
    padding: "30px 20px",
    borderBottom: "1px solid #eeeeee",
    color: "#333333",
    fontSize: "28px",
    margin: "0",
  },
  contentPadding: {
    padding: "40px 50px",
  },
  detailTable: {
    margin: "25px 0",
    border: "1px solid #dddddd",
    borderRadius: "4px",
    overflow: "hidden",
    width: "100%",
  },
  rowLight: {
    backgroundColor: "#f9f9f9",
    padding: "12px 20px",
    fontWeight: "bold",
    color: "#333333",
    width: "50%",
  },
  rowWhite: {
    backgroundColor: "#ffffff",
    padding: "12px 20px",
    fontWeight: "bold",
    color: "#333333",
    borderTop: "1px solid #eeeeee",
  },
  amountText: {
    color: "#333333",
    fontSize: "18px",
    fontWeight: "bold",
    textAlign: "right",
  },
};