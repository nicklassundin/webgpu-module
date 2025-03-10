struct Uniforms {
resolution: vec2<f32>
};

@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var heatMapTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
	let uv = (fragCoord.xy / uniforms.resolution);
	let color = textureSampleLevel(heatMapTexture, heatSampler, uv, 2.0);
	return color;
	//return vec4f(uv, 0.0, 1.0);
}
