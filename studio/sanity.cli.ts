import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "4udoq5d8",
    dataset: "production",
  },
  deployment: {
    autoUpdates: false,
  },
});
