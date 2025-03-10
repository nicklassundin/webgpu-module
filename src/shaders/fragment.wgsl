@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var heatMapTexture: texture_2d<f32>;


@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
	let texSize = vec2<f32>(textureDimensions(heatMapTexture).xy);
	let uv = fragCoord.xy / texSize;
	//let uv = fragCoord.xy / texSize * 0.05;
	let color = textureSampleLevel(heatMapTexture, heatSampler, uv, 0);
	//return vec4f(texSize.r, texSize.g, 0.0, 1.0);
	return vec4f(uv.x, uv.y, 0.0, 1.0);
	//return color;
}
