export const metadata = {
  title: "Diabetes A1C Prediction Dashboard",
  description: "Glycemic Control Risk Monitor",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0, padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: "#f8fafc",
      }}>
        {children}
      </body>
    </html>
  );
}
