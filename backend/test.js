require("dotenv").config();
const { callLLM } = require("./src/modules/ai/llm.service");

(async () => {
  const res = await callLLM("Maine Raj ko 100 diye aur usne mujhe 40 diye. Kitna balance hai?");
  console.log(res);
})();
