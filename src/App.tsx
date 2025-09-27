import {
  Container,
  Typography,
  Button,
  TextField,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemText
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import LanguageSwitcher from "./components/LanguageSwitcher";
import type {
  DomainParseErrorCode,
  DomainParseResult
} from "./utils/parseDomains";
import { parseDomains } from "./utils/parseDomains";

const ERROR_MESSAGE_KEYS: Record<DomainParseErrorCode, string> = {
  "invalid-format": "parse.errors.invalid-format",
  "invalid-length": "parse.errors.invalid-length",
  "no-tld": "parse.errors.no-tld",
  duplicate: "parse.errors.duplicate"
};

export default function App() {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [parseResult, setParseResult] = useState<DomainParseResult | null>(
    null
  );

  // 点击按钮后执行解析流程
  const handleCheck = () => {
    setParseResult(parseDomains(inputValue));
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t("app.title")}
      </Typography>

      <LanguageSwitcher fullWidth sx={{ mb: 2 }} />

      <TextField
        fullWidth
        placeholder={t("input.placeholder")}
        helperText={t("input.helper")}
        multiline
        minRows={4}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        sx={{ mb: 2 }}
      />
      <Button
        variant="contained"
        onClick={handleCheck}
        disabled={!inputValue.trim()}
      >
        {t("action.check")}
      </Button>

      {parseResult && (
        <Stack spacing={2} sx={{ mt: 3 }}>
          {parseResult.domains.length > 0 ? (
            <Stack spacing={1}>
              <Alert severity="success">
                {t("parse.summary", { count: parseResult.domains.length })}
              </Alert>
              <List dense disablePadding>
                {parseResult.domains.map((domain) => (
                  <ListItem key={domain.id}>
                    <ListItemText
                      primary={domain.domain}
                      secondary={
                        domain.ascii !== domain.domain ? domain.ascii : undefined
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Stack>
          ) : (
            <Alert severity="info">{t("parse.empty")}</Alert>
          )}

          {parseResult.errors.length > 0 && (
            <Alert severity="warning">
              <Stack spacing={1}>
                <Typography variant="subtitle2">
                  {t("parse.errors.title", {
                    count: parseResult.errors.length
                  })}
                </Typography>
                <List dense disablePadding>
                  {parseResult.errors.map((error, index) => (
                    <ListItem key={`${error.input}-${error.code}-${index}`}>
                      <ListItemText
                        primary={error.input}
                        secondary={t(ERROR_MESSAGE_KEYS[error.code])}
                      />
                    </ListItem>
                  ))}
                </List>
              </Stack>
            </Alert>
          )}
        </Stack>
      )}
    </Container>
  );
}
