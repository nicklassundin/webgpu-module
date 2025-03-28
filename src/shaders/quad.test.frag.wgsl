@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
	let texSize = vec2<f32>(textureDimensions(myTexture));
	let uv = fragCoord.xy / texSize;
	return textureSample(myTexture, mySampler, uv);
}
