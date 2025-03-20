
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};

@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var depthTexture: texture_2d<f32>;
@group(0) @binding(2) var valueTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
	let uv = (fragCoord.xy / uniforms.resolution);
	//let color = textureSampleLevel(depthTexture, heatSampler, uv, 0);
	let mipLevel = uniforms.mipLevel;
	let depth = textureSample(depthTexture, heatSampler, uv).x * mipLevel;

	// chess board pattern
	let x = i32(floor(uv.x * 10));
	let y = i32(floor(uv.y * 10));
	let c = (x + y) % 2;
	
	let checker_color = vec4<f32>(uv.x, uv.y - f32(c), f32(c), 1.0);
	
	let color = textureSampleLevel(valueTexture, heatSampler, uv, 10 - depth);
	return color;

}
