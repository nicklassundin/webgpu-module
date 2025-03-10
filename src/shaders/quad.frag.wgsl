//struct Uniforms {
//    resolution: vec2<f32>
//};

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
//@group(1) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
	let mipLevel = textureNumLevels(myTexture);
	let texSize = vec2<f32>(textureDimensions(myTexture)) / f32(1 << mipLevel);
	let uv = fragCoord.xy / texSize;
	let color = textureSample(myTexture, mySampler, uv);
	return vec4<f32>(color.x, color.yz, 1.0);
}
