

struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 

struct FragInput {
	@location(0) position: vec4<f32>,
	@location(1) values: vec4<f32>
};
@fragment
fn main(input: FragInput) -> @location(0) vec4f {
	let fragCoord = input.position;
	let pos = fragCoord.xy; 
	return fragCoord;
}
