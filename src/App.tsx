import { Button, Container, Typography } from "@mui/material";

function App() {
  return (
    <Container maxWidth="sm" style={{ marginTop: "2rem" }}>
      <Typography variant="h4" gutterBottom>
        Domain Checker
      </Typography>
      <Button variant="contained" color="primary">
        点我试试
      </Button>
    </Container>
  );
}

export default App;
