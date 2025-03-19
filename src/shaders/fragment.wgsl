
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};

@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var heatMapTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
	let uv = (fragCoord.xy / uniforms.resolution);
	//let color = textureSampleLevel(heatMapTexture, heatSampler, uv, 10);
	let color = textureSample(heatMapTexture, heatSampler, uv);

	// chess board pattern
	let x = i32(floor(uv.x * 10));
	let y = i32(floor(uv.y * 10));
	let c = (x + y) % 2;
	
	let checker_color = vec4<f32>(0.0, 1.0 - f32(c), f32(c), 1-(color.r + color.g) / 2.0);


	if (color.r + color.g + color.b > 0.0) {
	 	return vec4<f32>(uniforms.mipLevel/11.0, 0.0, 0.0, 1.0);
	}else{
		return checker_color;
	}
}
