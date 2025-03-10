struct Uniforms {
resolution: vec2<f32>
};

@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var heatMapTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
	let uv = fragCoord.xy / uniforms.resolution;
	let numLevels = textureNumLevels(heatMapTexture);
	let color = textureSampleLevel(heatMapTexture, heatSampler, uv, 0.5);
	//return vec4f(uv, numLevels, 1.0);
	return color;
}
