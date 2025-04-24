

struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 
// texture
@group(0) @binding(1) var textureSampler: sampler; 
@group(0) @binding(2) var texture: texture_2d<f32>;

struct FragInput {
	@location(0) position: vec4<f32>,
	@location(1) values: vec4<f32>
};
@fragment
fn main(input: FragInput) -> @location(0) vec4f {
	let fragCoord = input.position;
	let pos = fragCoord.xy; 
	let texDim = textureDimensions(texture);
	let uv = pos;
	return textureSample(texture, textureSampler, uv);
	//return fragCoord;
}
