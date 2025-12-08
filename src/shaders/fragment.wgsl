

struct Uniforms {
	resolution: vec2<f32>,
	_pad0: vec2<u32>,
	workgroupSize: vec2<u32>,
	_pad1: vec2<u32>,
	input: vec2<u32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 
// texture
@group(0) @binding(1) var textureSampler: sampler; 
@group(0) @binding(2) var texture: texture_2d<f32>;
@group(0) @binding(3) var depthTexture: texture_2d<u32>;
@group(0) @binding(4) var mipTexture: texture_2d<f32>;


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
	//return textureSample(texture, textureSampler, uv);

	let dims = textureDimensions(depthTexture);
	let xy = vec2<i32>(uv * vec2<f32>(dims));
	let value = textureLoad(depthTexture, xy, 0).r;
	
	//return textureSampleLevel(mipTexture, textureSampler, uv, 7);
	//var color = textureSampleLevel(mipTexture, textureSampler, uv, f32(value)-1);
	//var color = textureSampleLevel(mipTexture, textureSampler, uv, f32(value)-3);
	//var color = textureSampleLevel(mipTexture, textureSampler, uv, value*16-3);

	let uin = uniforms.input;
	if(uin.x == 3u) {
		let fvalue = f32(value)/16;
		return vec4<f32>(fvalue, fvalue, fvalue, 1);
	}
	// TODO swap this in mode to compare
	var color = textureSampleLevel(mipTexture, textureSampler, uv, f32(value));
	//var color = textureSampleLevel(texture, textureSampler, uv, f32(value));
	if (uin.x <= 1u) {
		color.y = 0.0;
		color.z = 0.0;
	}
	if (uin.x == 2u) {
		color.x = 0.0;
		color.x = color.y;
		color.y = color.z;
		color.z = 0.0;
	}
	return color;
	//return vec4<f32>(value, value, value, 1.0);
	//return fragCoord;
}
