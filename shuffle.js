import getPixels from "get-pixels";
import Jimp from "jimp";

const inFile = "input.jpg";

getPixels(inFile, function(err, pixels) {
    if(err) {
        console.error("Could not load image.");
    } else {
        // Loads the image's pixels into a two dimensional dimensional array.
        // The elements of each subarray are the [R, G, B, A] values of individual pixels.
        let inPixelRGBArray = [];
        for(let y = 0; y < pixels.shape[1]; y++) {
            for(let x = 0; x < pixels.shape[0]; x++) {
                const r = pixels.get(x, y, 0);
                const g = pixels.get(x, y, 1);
                const b = pixels.get(x, y, 2);
                const a = pixels.get(x, y, 3);
                const rgba = [r, g, b, a];
                inPixelRGBArray.push(rgba)
            }
        }

        // Runs the pixel array through the shuffler defined below.
        let outPixelRGBArrayFlat = processRules(inPixelRGBArray, 0)

        // We need to turn the RGB array into a matrix whose dimensions are equal to the original image's.
        // While we're at it, we'll also turn the RGBA values of each pixel into their hex values.
        // Both of these are necessary to save an image file with Jimp.
        // Problem: Somehow the output array of processRules() ends up with less pixels than the input.
        // I'm filling them in with black for now but where the hell did they go?
        let outPixelIntMatrix = []
        let i = 0;
        for(let y = 0; y < pixels.shape[1]; y++) {
            outPixelIntMatrix.push([])
            for(let x = 0; x < pixels.shape[0]; x++) {
                if(i < outPixelRGBArrayFlat.length) {
                    outPixelIntMatrix[y].push(Jimp.rgbaToInt(...outPixelRGBArrayFlat[i]))
                } else {
                    outPixelIntMatrix[y].push(Jimp.rgbaToInt(0, 0, 0, 0))
                }
                i++;
            }
        }

        // Saves the image to the file "output.jpg".
        let image = new Jimp(pixels.shape[0], pixels.shape[1], function(err, image) {
            if(err) throw err;

            outPixelIntMatrix.forEach((row, y) => {
                row.forEach((color, x) => {
                        image.setPixelColor(color, x, y);
                    }
                )})

            image.write("output.jpg", (err) => {
                if(err) throw err;
            })
        })
    }
})

// Patterns A and B determine the size of sub-chunks that are shuffled in the image.
// Pattern B Rule determines in which order the smallest sub-chunks are added to the output.
// The smallest value of Pattern A should be larger than the largest value of Pattern B.
// Pattern B Rule must consist of the numbers 0-3 in any order.
const PATTERN_A = [64, 80, 200];
const PATTERN_B = [4, 8, 12, 16];
const PATTERN_B_RULE = [3, 2, 0, 1];

// DO NOT CHANGE THESE.
const SHUFFLE = 0;
const SHUFFLE_G = 1;
const PERMUTATE = 2;
const DIVIDE_G = 3;

// DO NOT CHANGE THESE.
const shufflePattern = (p) => {return {method: SHUFFLE, p1: p, p2: p}}
const permutatePattern = (p, r) => {return {method: PERMUTATE, p1: p, p2: r}}
const shuffle = (w) => {return {method: SHUFFLE_G, len: w}}
const divide = (w) => {return {method: DIVIDE_G, len: w}}

// The numbers in divide() and shuffle() determine larger chunk sizes, not sure if they can be too large/small though.
const rules = [
    divide(1200 * 30),
    shuffle(200 * 40),
    shufflePattern(PATTERN_A),
    permutatePattern(PATTERN_B, PATTERN_B_RULE)
];

function processRules(pixels, depth) {
    let result = [];

    // We know we've gone too far when we've run out of rules.
    if(depth >= rules.length) {
        return pixels;
    }

    let chunks = [];
    let rule = rules[depth];

    // DIVIDE_G and SHUFFLE_G require us to make chunks out of everything that's available to us.
    if(rule.method === DIVIDE_G || rule.method === SHUFFLE_G) {
        let i = 0;
        while(i < pixels.length) {
            let l = rule.len;
            if((i + l) >= pixels.length) {
                l = pixels.length - i;
            }

            let chunk = {};
            chunk.ch = pixels.slice(i, i + l);
            chunks.push(chunk);
            i += l;
        }
    }

    // Randomly shuffle all chunks available when we're on SHUFFLE_G.
    if(rule.method === SHUFFLE_G) {
        chunks = chunks.sort(() => Math.random() - 0.5)
    }

    // These rules are for smaller sub-chunks.
    if(rule.method === SHUFFLE || rule.method === PERMUTATE) {
        let i = 0;
        let p = 0;
        let pchunks = []

        while(i < pixels.length) {

            // First we make those sub-chunks.
            let l = rule.p1[p];
            if((i + l) >= pixels.length) {
                l = pixels.length - i;
            }

            let chunk = {};
            chunk.ch = pixels.slice(i, i + l);
            pchunks.push(chunk);
            p++;

            // And then we either shuffle them randomly or permutate them in the order defined by PATTERN_B_RULE.
            if(p === rule.p1.length) {
                if(rule.method === SHUFFLE) {
                    pchunks = pchunks.sort(() => Math.random() - 0.5);
                    chunks = chunks.concat(pchunks);
                }
                if(rule.method === PERMUTATE) {
                    rule.p2.forEach(num => {
                        chunks.push(pchunks[num])
                    })
                }
                pchunks = []
                p = 0;
            }
            i += l;
        }
    }

    // Recursively call this function on increasingly smaller sub-chunks until we run out of rules.
    chunks.forEach(chunk => {
        chunk.ch = processRules(chunk.ch, depth + 1);
    })

    // Add all of the chunks to the final result array.
    chunks.forEach(chunk => {
        result = result.concat(chunk.ch);
    })
    return result;
}
