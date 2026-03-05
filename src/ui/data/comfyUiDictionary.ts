export type ComfyUiDictionaryCategory =
  | "Model components"
  | "Generation process"
  | "Sampling system"
  | "Guidance system"
  | "Sampling parameters"
  | "Image setup"
  | "Hardware and execution"
  | "Advanced components";

export type ComfyUiDictionaryItem = {
  id: string;
  term: string;
  category: ComfyUiDictionaryCategory;
  technicalDefinition: string;
  plainDefinition: string;
  analogyTerm?: string;
  analogyExplanation?: string;
};

export const comfyUiDictionaryItems: ComfyUiDictionaryItem[] = [
  {
    id: "unet",
    term: "UNet",
    category: "Model components",
    technicalDefinition:
      "A convolutional neural network architecture used in diffusion models to iteratively remove noise from latent representations and generate structured images.",
    plainDefinition: "The neural network responsible for actually turning noise into an image.",
    analogyTerm: "Image engine",
    analogyExplanation:
      "Like the engine of a car, this is the main machine doing the work of generating the picture.",
  },
  {
    id: "diffusion-model",
    term: "Diffusion model",
    category: "Model components",
    technicalDefinition:
      "A machine learning model trained to reverse a gradual noise process to synthesize data such as images.",
    plainDefinition:
      "The trained AI system that knows how images should look and gradually builds them from noise.",
    analogyTerm: "Image brain",
    analogyExplanation: "The brain that knows how objects, people, and scenes should look.",
  },
  {
    id: "clip",
    term: "CLIP (Contrastive Language Image Pretraining)",
    category: "Model components",
    technicalDefinition:
      "A model that encodes text and images into a shared embedding space so that prompts can guide image generation.",
    plainDefinition:
      "A model that understands your prompt and translates it into instructions the image model can follow.",
    analogyTerm: "Prompt interpreter",
    analogyExplanation: "Like a translator between human language and the AI image engine.",
  },
  {
    id: "text-encoder",
    term: "Text encoder",
    category: "Model components",
    technicalDefinition:
      "A neural network that converts textual prompts into numerical embeddings used by diffusion models.",
    plainDefinition: "The part of the system that turns your written prompt into math the model understands.",
    analogyTerm: "Language translator",
    analogyExplanation: "Converts words into machine instructions.",
  },
  {
    id: "vae",
    term: "VAE (Variational Autoencoder)",
    category: "Model components",
    technicalDefinition:
      "A neural network used to encode images into latent space and decode latent representations back into pixel images.",
    plainDefinition: "The system that converts compressed image math into visible images.",
    analogyTerm: "Image decoder",
    analogyExplanation: "Like unpacking a compressed file so you can actually see the picture.",
  },
  {
    id: "latent-space",
    term: "Latent space",
    category: "Model components",
    technicalDefinition:
      "A compressed multidimensional representation of image data used for efficient diffusion processing.",
    plainDefinition: "A simplified mathematical version of the image where the AI does most of its work.",
    analogyTerm: "Compressed canvas",
    analogyExplanation:
      "Instead of painting directly on the final canvas, the AI works on a smaller blueprint.",
  },
  {
    id: "noise",
    term: "Noise",
    category: "Generation process",
    technicalDefinition: "Random Gaussian noise used as the initial state for diffusion sampling.",
    plainDefinition: "Random static that the AI transforms into an image.",
    analogyTerm: "Chaos",
    analogyExplanation: "Like starting with TV static and slowly shaping it into a picture.",
  },
  {
    id: "noise-seed",
    term: "Noise seed",
    category: "Generation process",
    technicalDefinition: "A deterministic number used to initialize the random noise generator.",
    plainDefinition: "A number that determines the exact starting pattern of noise.",
    analogyTerm: "Image DNA",
    analogyExplanation: "If you reuse the same seed, you recreate the same image.",
  },
  {
    id: "diffusion",
    term: "Diffusion",
    category: "Generation process",
    technicalDefinition:
      "A generative process that gradually removes noise through learned reverse transformations.",
    plainDefinition: "The step-by-step process of turning static into an image.",
    analogyTerm: "Image sculpting",
    analogyExplanation: "Like sculpting a statue from a block of marble.",
  },
  {
    id: "sampler",
    term: "Sampler",
    category: "Sampling system",
    technicalDefinition: "A numerical algorithm used to solve the reverse diffusion process.",
    plainDefinition: "The mathematical method used to refine noise into an image.",
    analogyTerm: "Refinement method",
    analogyExplanation: "Different techniques for shaping the image.",
  },
  {
    id: "euler-sampler",
    term: "Euler sampler",
    category: "Sampling system",
    technicalDefinition: "A first-order numerical method used in diffusion sampling.",
    plainDefinition: "A fast sampling algorithm that produces strong images quickly.",
    analogyTerm: "Fast sculpting method",
  },
  {
    id: "dpmpp-sampler",
    term: "DPM++ sampler",
    category: "Sampling system",
    technicalDefinition:
      "A higher-order solver for diffusion models offering better stability and detail.",
    plainDefinition: "A more precise sampler often producing smoother results.",
    analogyTerm: "Precision sculpting",
  },
  {
    id: "cfg",
    term: "CFG (Classifier Free Guidance)",
    category: "Guidance system",
    technicalDefinition:
      "A technique that adjusts the influence of the prompt during diffusion by scaling the difference between conditional and unconditional predictions.",
    plainDefinition: "Controls how strongly the AI follows the prompt.",
    analogyTerm: "Prompt strength",
    analogyExplanation: "Higher values force the model to obey the prompt more strictly.",
  },
  {
    id: "positive-prompt",
    term: "Positive prompt",
    category: "Guidance system",
    technicalDefinition: "Text input describing elements to encourage in generated images.",
    plainDefinition: "What you want in the image.",
    analogyTerm: "Creative instructions",
  },
  {
    id: "negative-prompt",
    term: "Negative prompt",
    category: "Guidance system",
    technicalDefinition: "Text input specifying features to suppress during generation.",
    plainDefinition: "What you do not want in the image.",
    analogyTerm: "Avoid list",
  },
  {
    id: "steps",
    term: "Steps",
    category: "Sampling parameters",
    technicalDefinition: "The number of iterations used in the reverse diffusion process.",
    plainDefinition: "How many times the AI refines the image.",
    analogyTerm: "Refinement passes",
  },
  {
    id: "scheduler",
    term: "Scheduler",
    category: "Sampling parameters",
    technicalDefinition: "A function controlling the noise schedule across diffusion steps.",
    plainDefinition: "Controls how noise decreases during generation.",
    analogyTerm: "Refinement plan",
  },
  {
    id: "sigma",
    term: "Sigma",
    category: "Sampling parameters",
    technicalDefinition: "The noise level used at each diffusion step.",
    plainDefinition: "The strength of noise at each stage of generation.",
    analogyTerm: "Noise intensity",
  },
  {
    id: "latent-image",
    term: "Latent image",
    category: "Image setup",
    technicalDefinition: "The latent tensor representing the image before decoding.",
    plainDefinition: "The compressed mathematical image before it becomes pixels.",
    analogyTerm: "Blueprint image",
  },
  {
    id: "width",
    term: "Width",
    category: "Image setup",
    technicalDefinition: "Horizontal resolution of the generated image.",
    plainDefinition: "How wide the image is.",
    analogyTerm: "Canvas width",
  },
  {
    id: "height",
    term: "Height",
    category: "Image setup",
    technicalDefinition: "Vertical resolution of the generated image.",
    plainDefinition: "How tall the image is.",
    analogyTerm: "Canvas height",
  },
  {
    id: "batch-size",
    term: "Batch size",
    category: "Image setup",
    technicalDefinition: "The number of images generated simultaneously.",
    plainDefinition: "How many images are created at once.",
    analogyTerm: "Image count",
  },
  {
    id: "device",
    term: "Device",
    category: "Hardware and execution",
    technicalDefinition: "The hardware used to run the model.",
    plainDefinition: "Whether the model runs on the CPU or GPU.",
    analogyTerm: "Compute engine",
  },
  {
    id: "weight-precision",
    term: "Weight precision (dtype)",
    category: "Hardware and execution",
    technicalDefinition: "Numerical precision used to store model weights.",
    plainDefinition: "How precisely the model numbers are stored in memory.",
    analogyTerm: "Memory precision",
  },
  {
    id: "lora",
    term: "LoRA (Low Rank Adaptation)",
    category: "Advanced components",
    technicalDefinition:
      "A technique that fine-tunes diffusion models by adding small trainable matrices to existing weights.",
    plainDefinition:
      "A small add-on model that teaches the main model a new style or character.",
    analogyTerm: "Consistent Modelling",
    analogyExplanation: "A small add-on model that teaches the main model a new style, prop, setting, or character by adding small trainable matrices to existing weights.",
  },
  {
    id: "embedding",
    term: "Embedding",
    category: "Advanced components",
    technicalDefinition: "A vector representation of text or images used by neural networks.",
    plainDefinition: "A numeric representation of meaning.",
    analogyTerm: "Concept code",
  },
  {
    id: "conditioning",
    term: "Conditioning",
    category: "Advanced components",
    technicalDefinition: "Additional inputs used to guide diffusion generation.",
    plainDefinition: "Extra information that influences the output image.",
    analogyTerm: "Creative direction",
  },
];

export const comfyUiPipelineOverview: string[] = [
  "Prompt enters system",
  "CLIP converts words into embeddings",
  "Noise seed creates starting chaos",
  "UNet gradually removes noise",
  "Sampler determines refinement style",
  "Scheduler controls noise reduction timing",
  "CFG controls prompt influence",
  "Latent image forms",
  "VAE decodes latent to pixels",
  "Final image appears",
];

export const comfyUiSuggestedLabels: Array<{ technical: string; label: string }> = [
  { technical: "UNet", label: "Image engine" },
  { technical: "CLIP", label: "Prompt brain" },
  { technical: "VAE", label: "Image decoder" },
  { technical: "Sampler", label: "Generation method" },
  { technical: "Scheduler", label: "Refinement plan" },
  { technical: "CFG", label: "Prompt strength" },
  { technical: "Steps", label: "Detail passes" },
  { technical: "Seed", label: "Image DNA" },
  { technical: "Latent", label: "Blueprint image" },
];

