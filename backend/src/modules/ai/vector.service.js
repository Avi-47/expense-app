const ENABLE_VECTOR = process.env.ENABLE_VECTOR === "true";

let collection = null;

exports.initVectorDB = async () => {
  if (!ENABLE_VECTOR) {
    console.log("Vector DB disabled via feature flag");
    return;
  }

  // Future: real vector initialization
};

exports.storeMemory = async (groupId, text, metadata) => {
  if (!ENABLE_VECTOR) return;
};

exports.searchMemory = async (groupId, query) => {
  if (!ENABLE_VECTOR) return [];
  return [];
};
