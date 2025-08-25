

struct Uniforms {
resolution: vec2<f32>,
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
	var uv = pos;
	// turn uv counter clockwise
	// TODO fix but should be form data
	//uv = vec2<f32>(1.0 - uv.y, uv.x);
	return textureSample(texture, textureSampler, uv);
	//return fragCoord;
}
