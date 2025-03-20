
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};

@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var quadMipTexture: texture_2d<f32>;
@group(0) @binding(2) var frame: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
	let resolution = textureDimensions(quadMipTexture, 0).xy;
	let uv = (fragCoord.xy / vec2<f32>(resolution));
	
	let value = textureSampleLevel(quadMipTexture, heatSampler, uv, uniforms.mipLevel);
	let color = textureSampleLevel(frame, heatSampler, uv, uniforms.mipLevel+1); 
	
	if (value.x > 0.0) {
		return vec4<f32>(vec3<f32>((11 - uniforms.mipLevel)/11.0), 1.0);
	}
	return color;
};
