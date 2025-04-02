
struct Traversal {
	depth: f32,
	_pad: vec3<f32>,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
	_pad2: vec3<f32>,
	_pad4: vec4<f32>,
	_pad5: vec4<f32>,
};

@group(0) @binding(0) var<storage, read_write> vertices: array<f32>;
@group(0) @binding(1) var<storage, read_write> indices: array<u32>;



@group(1) @binding(0) var<storage, read> selected: array<f32>;
@group(1) @binding(1) var<storage, read> levelValues: array<f32>;


@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let index = global_id.x;
	vertices[index] = 0.0;
	vertices[index + 1] = 0.0;
	vertices[index + 2] = 0.0;
	vertices[index + 3] = 1.0;
	
	vertices[index + 4] = 0.0;
	vertices[index + 5] = 1.0;
	vertices[index + 6] = 0.0;
	vertices[index + 7] = 1.0;

	vertices[index + 8] = 1.0;
	vertices[index + 9] = 0.0;
	vertices[index + 10] = 0.0;
	vertices[index + 11] = 1.0;

	vertices[index + 12] = 1.0;
	vertices[index + 13] = 1.0;
	vertices[index + 14] = 0.0;
	vertices[index + 15] = 1.0;

	indices[index] = 0;
	indices[index + 1] = 1;
	indices[index + 2] = 2;
	indices[index + 3] = 1;
	indices[index + 4] = 2;
	indices[index + 5] = 3;
}
