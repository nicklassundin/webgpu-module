@group(0) @binding(0) var<storage, read_write> values: array<f32>;
@group(0) @binding(1) var<storage, read_write> nodes: array<u32>;
@group(1) @binding(0) var samplerTex: sampler;
@group(1) @binding(1) var textureMipMap: texture_2d<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let index = global_id.x;
	// Ensure we don't go out of bounds
	if (index < arrayLength(&values)) {
		values[index] = values[index] + 1.0; // Example: Increment each value
	}
}
