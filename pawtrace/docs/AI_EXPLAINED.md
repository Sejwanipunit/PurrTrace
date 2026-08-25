# PawTrace AI — How It Works (Interview Study Guide)

A from-scratch explanation of the two on-device AI features in PawTrace:

1. **Photo auto-tagging** — guess species/breed/colour from a photo.
2. **Possible matches** — rank lost/found pets by how visually similar they look.

Both run **entirely in the browser** with **TensorFlow.js + MobileNet** — no API, no keys, no
tokens, no server. This doc teaches the concepts, walks the real code, and drills the questions an
interviewer will actually ask.

Code lives in [`src/lib/petVision.ts`](../src/lib/petVision.ts) (the ML) and
[`src/lib/petAI.ts`](../src/lib/petAI.ts) (the product logic).

---

## 0. The 30-second pitch (memorize this)

> "Both features run a pre-trained neural network, **MobileNet**, directly in the user's browser via
> **TensorFlow.js**. For auto-tagging I use it as a **classifier** — it outputs probabilities over
> 1,000 ImageNet categories, which include ~120 dog breeds and several cat types. For matching I use
> it as a **feature extractor**: I take the network's internal representation of each photo — an
> **embedding** — and rank candidates by **cosine similarity**. It's free, private (images never
> leave the device), and needs no backend."

That one paragraph name-drops: transfer learning, on-device inference, embeddings, cosine
similarity, and the product tradeoff. Everything below unpacks it.

---

## 1. Big-picture architecture

```
                          THE USER'S BROWSER (nothing leaves it)
  ┌───────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │   photo ──►  MobileNet (a pre-trained CNN, ~16MB, cached)               │
  │                 │                                                       │
  │        ┌────────┴─────────┐                                            │
  │        ▼                  ▼                                            │
  │   classify()          infer(img, true)                                 │
  │   1000 probs          1280-number embedding                            │
  │        │                  │                                            │
  │        ▼                  ▼                                            │
  │   AUTO-TAGGING        MATCHING                                          │
  │   species/breed       cosine-similarity vs other pets → ranked list    │
  └───────────────────────────────────────────────────────────────────────┘
```

We **load** the model from a CDN once; inference then runs locally on the GPU (WebGL).

---

## 2. What is a CNN, and what is MobileNet?

### CNN (Convolutional Neural Network)
The standard architecture for images. It stacks layers that learn visual features in increasing
abstraction:

```
  early layers        middle layers          late layers
  edges, colours  →   ears, snouts, eyes  →  "this is a Labrador"
```

The workhorse is the **convolution**: a small filter (e.g. 3×3) slides across the image, multiplying
and summing pixels to detect a pattern. One filter might fire on vertical edges, another on fur
texture. Sketch of a single 3×3 filter producing one output pixel:

```
  input patch          filter (kernel)        output
  ┌───┬───┬───┐        ┌───┬───┬───┐
  │ 12│ 20│ 18│        │ 0 │ 1 │ 0 │
  ├───┼───┼───┤   ⊙    ├───┼───┼───┤   =  Σ(patch × filter) = one number
  │ 10│ 25│ 22│        │ 1 │-4 │ 1 │      (a "how strongly is this
  ├───┼───┼───┤        ├───┼───┼───┤       pattern present here?" score)
  │  8│ 19│ 21│        │ 0 │ 1 │ 0 │
  └───┴───┴───┘        └───┴───┴───┘
        └─── slide this window over the whole image → a "feature map" ───┘
```

Stack hundreds of these + downsampling, and the network turns a raw grid of pixels into a compact
set of high-level features. **The network learned the filter values by training on millions of
images** — we don't hand-design them.

### MobileNet — a CNN built to be small & fast
MobileNet is a CNN designed to run on phones/browsers. Its key efficiency trick is the
**depthwise separable convolution**, which factors a normal convolution into two cheaper steps and
cuts the compute ~8–9× with minimal accuracy loss. That's *why* it fits in a browser tab.
(MobileNet**V2**, which we use, adds "inverted residuals + linear bottlenecks" — you can mention it,
but "depthwise separable convolutions make it cheap" is the point that lands.)

It's **pre-trained on ImageNet** — 1.28M images, 1,000 classes. We reuse Google's trained weights and
never train anything ourselves. Reusing a model trained on one task for a related task is called
**transfer learning**.

---

## 3. One model, two outputs

A classifier CNN = a **feature extractor** (deep conv stack) + a **classification head** (a final
dense layer + **softmax** that converts features into 1,000 probabilities).

```
 photo ─► [ feature extractor ] ─► EMBEDDING (1280 numbers) ─► [ head + softmax ] ─► 1000 probabilities
                                        ▲                                                  ▲
                              MATCHING grabs THIS                            AUTO-TAGGING grabs THIS
                              model.infer(img, true)                         model.classify(img)
```

- **`model.classify(img)`** → `[{className: "collie", probability: 0.87}, …]` (uses the very end).
- **`model.infer(img, true)`** → a 1280-length vector (the penultimate layer). The `true` = "return
  the embedding, not the prediction."

**Key insight:** the penultimate layer is a compressed numeric summary of *what the image looks like*.
Two photos of the same dog produce two **nearby** vectors. That's the whole basis of matching.

---

## 4. Embeddings + cosine similarity (the heart of matching)

An **embedding** is a vector where "similar things are close together." We can't picture 1280-D, but
the intuition is identical in 2-D:

```
        ▲ feature 2 (e.g. "fur-ness")
        │
        │   • golden retriever A
        │  • golden retriever B      A and B point almost the same way → SIMILAR (small angle θ)
        │ θ⌒
        │╱ ╲
        │   ╲          • black cat   very different direction → NOT similar (large angle)
        └───────────────────────────► feature 1 (e.g. "dark-ness")
```

**Cosine similarity** measures that angle:

```
                A · B
  sim(A,B) = ───────────       (dot product ÷ product of lengths)
             ‖A‖ · ‖B‖
```

- Same direction → cos(0°) = **1**. Perpendicular → cos(90°) = **0**.
- **Why cosine, not Euclidean distance?** Cosine cares about *direction* (the pattern of features),
  not *magnitude* (how bright/large). For embeddings, direction carries the meaning — so cosine is
  the standard similarity for embeddings, search, and recommendations.

### The normalization trick we used
If you **L2-normalize** each vector first (scale it to length 1), then `‖A‖ = ‖B‖ = 1` and the whole
formula collapses to just the **dot product** `A · B`. Cheaper and cleaner — that's exactly what
`embed()` does before `cosineSimilarity()` runs a plain dot-product loop.

```
  raw vector  ──normalize──►  unit vector (length 1)  ──►  cosine = dot product
```

---

## 5. The real code, annotated

### `src/lib/petVision.ts` — the ML layer

```ts
// Turn a photo into a 1280-D embedding, L2-normalized so dot product == cosine similarity.
export async function embed(img) {
  const model = await getModel();
  const tensor = model.infer(img, true);   // true → embedding, not classification
  const raw = tensor.dataSync();            // copy numbers off the GPU into JS
  tensor.dispose();                         // free GPU memory — tensors aren't garbage-collected!
  let norm = 0;
  for (const v of raw) norm += v * v;       // sum of squares
  norm = Math.sqrt(norm) || 1;              // ‖A‖ = vector length
  return raw.map(v => v / norm);            // scale to length 1
}

// Because both vectors are unit-length, cosine similarity is just their dot product.
export function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));     // clamp to [0,1] for display
}
```

Two details interviewers notice:
- **`tensor.dispose()`** — TF.js tensors live on the GPU and are *not* freed by JS garbage
  collection. Forgetting this leaks GPU memory. (Its sibling is `tf.tidy()`.)
- **Lazy loading** — `getModel()` only downloads the model the first time an AI feature is used, so
  the app's initial load stays fast.

### `src/lib/petAI.ts` — the product logic

```ts
export async function findPossibleMatches(subject, candidates) {
  const subjectVec = await embed(await loadImageEl(subject.imageUrl));  // embed subject once
  const scored = [];
  for (const c of candidates) {                    // O(n): compare against each candidate
    const vec = await embed(await loadImageEl(c.imageUrl));
    const sim = cosineSimilarity(subjectVec, vec);
    if (sim >= 0.5) scored.push({ id: c.id, confidence: Math.round(sim * 100), ... });
  }
  return scored.sort((a, b) => b.confidence - a.confidence).slice(0, 4);  // top 4
}
```

### Auto-tagging: mapping ImageNet labels to your app's world

MobileNet knows "collie" and "Egyptian cat," not your enum `'dog' | 'cat' | 'other'`. So we map:

```ts
const labels = results.map(r => r.className.toLowerCase());
const joined = labels.join(' ');
const species = CAT_HINTS.some(h => joined.includes(h)) ? 'cat'
              : DOG_HINTS.some(h => joined.includes(h)) ? 'dog'
              : 'other';
const breed = species === 'other' ? '' : titleCase(results[0].className.split(',')[0]);
```

This "post-process the model's raw output into product-shaped data" step is real ML-engineering work,
not just calling `classify()`.

### Bonus: `dominantColor()` is *classical* computer vision (no ML)

Draw the photo onto a tiny 40×40 canvas, average the pixels (skipping near-white background), and
snap the average RGB to the nearest named colour. Good to know the difference: **CNN = learned
features; this = hand-written pixel math.** Both are "computer vision."

---

## 6. The debugging war story (great for "tell me about a hard bug")

> "MobileNet worked from a CDN but crashed when imported through our Vite bundler with a cryptic
> `SyntaxError: Unexpected token '('`. I isolated the variable by loading TF.js three ways: through
> the app's bundler (**failed**), via a raw CDN `<script>` tag (**worked** — ran a tensor op on
> WebGL), and a bare dynamic import in the console (failed for an *unrelated* reason — bare
> specifiers don't resolve in raw eval). The CDN success proved the browser and the library were
> both fine, so the culprit was the **dev bundler mis-transforming the tfjs package**. I switched to
> loading TF.js + MobileNet from a CDN at runtime, which fixed both dev and prod and kept our main
> JS bundle small."

The lesson isn't the fix — it's the **method**: form a hypothesis, isolate one variable at a time,
let evidence point at the real cause.

---

## 7. The scaling question (this one wins interviews)

> **"You compare the subject against every candidate. What happens at 100,000 pets?"**

Today matching is **O(n) per query** and runs on the client — fine for a few nearby candidates,
terrible for a global scan. The production answer is **precompute embeddings + nearest-neighbor
search in a vector database**. We're already on Supabase, which ships **pgvector**:

```sql
-- 1. store an embedding per pet
create extension if not exists vector;
alter table pets add column embedding vector(1280);

-- 2. an approximate-nearest-neighbor index (HNSW) for sub-linear search
create index on pets using hnsw (embedding vector_cosine_ops);

-- 3. find the 10 most visually-similar FOUND pets to a given lost pet.
--    <=> is pgvector's cosine-distance operator (smaller = more similar)
select id, name, 1 - (embedding <=> $1) as similarity
from pets
where status = 'found' and species = $2
order by embedding <=> $1
limit 10;
```

Flow: compute each pet's embedding **once at upload** (client or a serverless function), store the
`vector(1280)`, and at query time let the HNSW index return top-k in roughly **O(log n)** instead of
scanning everything. That's how real visual-search / recommendation / RAG systems work — and it maps
one-to-one onto what we already built.

Name-drop set: **pgvector, FAISS, Pinecone, HNSW, IVFFlat, approximate nearest neighbor (ANN)**.

---

## 8. Rapid-fire interview Q&A

**Q: What's an embedding?**
A learned vector representation where similar inputs land near each other. Here it's the CNN's
penultimate-layer activations — a 1280-number "fingerprint" of the image.

**Q: Why cosine similarity instead of Euclidean distance?**
Direction encodes meaning for embeddings; magnitude usually doesn't. Normalizing the vectors and
taking a dot product is the efficient form of cosine.

**Q: Why did you L2-normalize?**
So cosine similarity reduces to a plain dot product, and so scores are comparable across images
regardless of vector magnitude.

**Q: Where does the 0.5 threshold come from?**
Empirical. It's a **precision/recall knob** — raise it for fewer false matches (precision), lower it
to catch more (recall). To set it rigorously I'd label same/different pet pairs and pick the point
off a precision-recall or ROC curve.

**Q: Are you training a model?**
No — this is **inference** with a pre-trained model (transfer learning). No labelled data, no
training loop, no gradient descent at runtime.

**Q: How does a neural net run in a browser?**
TensorFlow.js executes the network on the **GPU via WebGL** (falling back to WASM/CPU). Inference
takes ~1–2s locally after the model is cached.

**Q: On-device vs a cloud API (Claude/GPT vision) — tradeoffs?**
On-device: free, private, no backend, offline after caching — but limited to ImageNet's classes, a
~16MB first load, and no natural-language reasoning. Cloud API: much better accuracy + written
explanations, but costs tokens and needs a backend to hide the key.

**Q: Biggest weakness of your matching?**
MobileNet embeds the *whole scene*, including background — so the same pet on a very different
background scores lower. Fix: run an **object detector** to crop to the animal, then embed just the
crop. You could also **fine-tune** the model on pet images for a pet-specific embedding.

**Q: How would you make it more accurate without paying for an API?**
Crop-to-subject first; average embeddings across a pet's multiple photos; fine-tune MobileNet on a
dog/cat dataset; or use a stronger open model (e.g. CLIP) for embeddings.

**Q: Privacy?**
Images never leave the device for the AI step — a genuine selling point, especially for a
community/safety app.

---

## 9. Vocabulary to sound fluent

CNN · convolution / filter / kernel · feature map · depthwise separable convolution · ImageNet ·
transfer learning · inference vs training · feature extractor vs classification head · logits ·
softmax · **embedding / feature vector** · **L2 normalization** · **cosine similarity** ·
dot product · nearest-neighbor search · **ANN / HNSW / IVFFlat** · **pgvector / FAISS / Pinecone** ·
precision / recall · ROC curve · WebGL / WASM inference · object detection · fine-tuning · CLIP.

---

## 10. Go deeper

- TensorFlow.js: <https://www.tensorflow.org/js>
- MobileNetV2 paper — "Inverted Residuals and Linear Bottlenecks"
- pgvector: <https://github.com/pgvector/pgvector>
- Search "embeddings and cosine similarity" and "approximate nearest neighbor HNSW" for visuals.

You built every concept on this page into a shipping app — that's exactly the story that lands in an
interview. Walk them through this doc top to bottom and you'll sound like you've done production ML.
